import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import * as Location from 'expo-location'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Animated, Dimensions, Keyboard, KeyboardAvoidingView, Platform, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import './i18n'
import { loadStoredLanguage } from './i18n'
import AppModals from './components/AppModals'
import BottomNavBar from './components/BottomNavBar'
import CameraTabContent from './components/CameraTabContent'
import MapTabContent from './components/MapTabContent'
import {
  INITIAL_REGION,
  NAVBAR_HORIZONTAL_PADDING,
  SEARCH_BUTTON_HEIGHT,
} from './constants/appConstants'
import { styles } from './styles/appStyles'

WebBrowser.maybeCompleteAuthSession()

const TILE_PROXY_BASE_URL =
  Constants.expoConfig?.extra?.tileProxyBaseUrl ?? 'http://10.0.2.2:8000'
const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://10.0.2.2:8000'

const ANDROID_KEYBOARD_EXTRA_OFFSET = 0

function App() {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const mapRef = useRef(null)
  const originRef = useRef(null)
  const [collapseAnim] = useState(() => new Animated.Value(0))
  const [panelExpandAnim] = useState(() => new Animated.Value(0))
  const [panelMinimizeAnim] = useState(() => new Animated.Value(0))
  const [isPanelExpanded, setIsPanelExpanded] = useState(false)
  const [isPanelMinimized, setIsPanelMinimized] = useState(false)
  const [mapType, setMapType] = useState('roadmap')
  const [activeTab, setActiveTab] = useState('home')
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeAutocomplete, setPlaceAutocomplete] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const autocompleteTimeoutRef = useRef(null)
  const [originInput, setOriginInput] = useState('')
  const [destinationInput, setDestinationInput] = useState('')
  const [originPlace, setOriginPlace] = useState(null)
  const [destinationPlace, setDestinationPlace] = useState(null)
  const [originAutocomplete, setOriginAutocomplete] = useState([])
  const [destinationAutocomplete, setDestinationAutocomplete] = useState([])
  const [activeNavInput, setActiveNavInput] = useState(null) // 'origin' | 'destination' | null
  const [routeData, setRouteData] = useState(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [routeObstacles, setRouteObstacles] = useState([])
  const [isFollowingRoute, setIsFollowingRoute] = useState(false)
  const originAutocompleteRef = useRef(null)
  const destinationAutocompleteRef = useRef(null)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [currentHeading, setCurrentHeading] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [dividerCenterY, setDividerCenterY] = useState(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [userData, setUserData] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [badgeModalVisible, setBadgeModalVisible] = useState(false)
  const [selectedBadge, setSelectedBadge] = useState(null)
  const [badges] = useState([
    { id: 'test', name: 'test', image: { uri: '/vite.svg' }, description: '테스트 배지 (Vite SVG)' },
  ])
  const [bottomNavWidth, setBottomNavWidth] = useState(0)
  const [bottomNavHeight, setBottomNavHeight] = useState(0)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [navIndicatorAnim] = useState(() => new Animated.Value(0))

  const tileUrlTemplate = useMemo(() => {
    const normalizedLanguage = `${i18n.language ?? 'en'}`.toLowerCase()
    const isKorean = normalizedLanguage.startsWith('ko')
    const tileLanguage = isKorean ? 'ko-KR' : 'en-US'
    const tileRegion = isKorean ? 'KR' : 'US'
    const tileQuery = `lang=${encodeURIComponent(tileLanguage)}&region=${encodeURIComponent(tileRegion)}`
    const normalizedBase = `${TILE_PROXY_BASE_URL}`.replace(/\/+$/, '')
    return `${normalizedBase}/maps/tiles/{z}/{x}/{y}.png?${tileQuery}&mapType=${encodeURIComponent(mapType)}`
  }, [mapType, i18n.language])

  const navigationSummary = useMemo(
    () => {
      if (routeData) {
        const now = new Date()
        const durationMinutes = Math.round(routeData.duration_value / 60)
        const eta = new Date(now.getTime() + routeData.duration_value * 1000)
        const etaStr = `${eta.getHours().toString().padStart(2, '0')}:${eta.getMinutes().toString().padStart(2, '0')}`
        return {
          from: originInput.trim() || t('navigation.currentLocation'),
          to: destinationInput.trim(),
          eta: etaStr,
          duration: routeData.duration,
          distance: routeData.distance,
          obstacleCount: routeData.obstacle_count || 0,
          isAccessible: routeData.is_accessible,
        }
      }
      return {
        from: originInput.trim(),
        to: destinationInput.trim(),
        eta: '',
        duration: '',
        distance: '',
        obstacleCount: 0,
        isAccessible: true,
      }
    },
    [originInput, destinationInput, routeData, t],
  )
  const hasNavigationInputs = (originPlace || currentLocation) && destinationPlace
  const hasRouteData = routeData !== null

  useEffect(() => {
    let watchSubscription
    let headingSubscription
    let mounted = true

    const loadLoginData = async () => {
      try {
        const storedData = await AsyncStorage.getItem('userData')
        const storedToken = await AsyncStorage.getItem('accessToken')
        if (storedData && mounted) {
          const parsedData = JSON.parse(storedData)
          setUserData(parsedData)
          setLoggedIn(true)
        }
        if (storedToken && mounted) {
          setAccessToken(storedToken)
        }
      } catch {
        // Ignore persisted login read failures.
      }
    }

    const startLocationTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        if (mounted) {
          setLocationError(t('location.permissionRequired'))
        }
        return
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })

      if (mounted) {
        setCurrentLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        })
      }

      watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        ({ coords }) => {
          if (!mounted) {
            return
          }

          setCurrentLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
          })
        },
      )

      headingSubscription = await Location.watchHeadingAsync((headingData) => {
        if (!mounted) {
          return
        }
        setCurrentHeading(headingData.trueHeading ?? headingData.magHeading)
      })
    }

    loadLoginData()
    loadStoredLanguage()
    startLocationTracking().catch(() => {
      if (mounted) {
        setLocationError(t('location.loadFailed'))
      }
    })

    return () => {
      mounted = false
      if (watchSubscription) {
        watchSubscription.remove()
      }
      if (headingSubscription) {
        headingSubscription.remove()
      }
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current)
      }
    }
  }, [])

  const focusMyLocation = useCallback(() => {
    if (!currentLocation || !mapRef.current) {
      return
    }

    mapRef.current.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      300,
    )
  }, [currentLocation])

  useEffect(() => {
    if (!isFollowingRoute || !currentLocation || !mapRef.current || activeTab !== 'navigation') {
      return
    }

    mapRef.current.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      350,
    )
  }, [isFollowingRoute, currentLocation, activeTab])

  const sanitizeNavPredictions = useCallback((predictions = []) => {
    const predictionList = Array.isArray(predictions) ? predictions : []
    const blockedLabels = new Set(
      [
        t('search.originPlaceholder'),
        t('search.destinationPlaceholder'),
        '출발지',
        '목적지',
      ]
        .filter((label) => typeof label === 'string' && label.trim())
        .map((label) => label.trim().toLowerCase()),
    )

    const seen = new Set()
    return predictionList.filter((prediction) => {
      const mainText = `${prediction?.main_text ?? ''}`.trim()
      if (!mainText) return false

      if (blockedLabels.has(mainText.toLowerCase())) {
        return false
      }

      const placeId = `${prediction?.place_id ?? ''}`.trim()
      const dedupeKey = placeId || `${mainText}|${`${prediction?.secondary_text ?? ''}`.trim()}`
      if (seen.has(dedupeKey)) {
        return false
      }
      seen.add(dedupeKey)
      return true
    })
  }, [t])

  const fetchNavAutocomplete = useCallback(async (query, type) => {
    if (!query.trim()) {
      if (type === 'origin') setOriginAutocomplete([])
      else setDestinationAutocomplete([])
      return
    }

    try {
      const locationParam = currentLocation
        ? `&location=${currentLocation.latitude},${currentLocation.longitude}`
        : ''
      const response = await fetch(
        `${API_BASE_URL}/places/autocomplete?input=${encodeURIComponent(query)}${locationParam}&language=ko`
      )
      const data = await response.json()
      const predictions = sanitizeNavPredictions(data.predictions)
      if (type === 'origin') setOriginAutocomplete(predictions)
      else setDestinationAutocomplete(predictions)
    } catch {
      if (type === 'origin') setOriginAutocomplete([])
      else setDestinationAutocomplete([])
    }
  }, [currentLocation, sanitizeNavPredictions])

  const handleOriginInputChange = useCallback((text) => {
    setOriginInput(text)
    setOriginPlace(null)
    setDestinationAutocomplete([])
    setActiveNavInput('origin')

    if (originAutocompleteRef.current) {
      clearTimeout(originAutocompleteRef.current)
    }

    if (!text.trim()) {
      setOriginAutocomplete([])
      return
    }

    originAutocompleteRef.current = setTimeout(() => {
      fetchNavAutocomplete(text, 'origin')
    }, 300)
  }, [fetchNavAutocomplete])

  const handleDestinationInputChange = useCallback((text) => {
    setDestinationInput(text)
    setDestinationPlace(null)
    setOriginAutocomplete([])
    setActiveNavInput('destination')

    if (destinationAutocompleteRef.current) {
      clearTimeout(destinationAutocompleteRef.current)
    }

    if (!text.trim()) {
      setDestinationAutocomplete([])
      return
    }

    destinationAutocompleteRef.current = setTimeout(() => {
      fetchNavAutocomplete(text, 'destination')
    }, 300)
  }, [fetchNavAutocomplete])

  const handleSelectNavPlace = useCallback(async (prediction, type) => {
    if (type === 'origin') {
      setOriginInput(prediction.main_text)
      setOriginAutocomplete([])
      setOriginPlace({
        placeId: prediction.place_id,
        name: prediction.main_text,
        address: prediction.secondary_text,
      })
    } else {
      setDestinationInput(prediction.main_text)
      setDestinationAutocomplete([])
      setDestinationPlace({
        placeId: prediction.place_id,
        name: prediction.main_text,
        address: prediction.secondary_text,
      })
    }
    setActiveNavInput(null)

    try {
      const response = await fetch(
        `${API_BASE_URL}/places/details/${prediction.place_id}?language=ko`
      )
      const data = await response.json()

      if (data.place) {
        const place = {
          placeId: data.place.place_id,
          name: data.place.name,
          address: data.place.address,
          latitude: data.place.latitude,
          longitude: data.place.longitude,
        }
        if (type === 'origin') {
          setOriginPlace(place)
        } else {
          setDestinationPlace(place)
        }
      }
    } catch {
      // Ignore place details fetch errors
    }
  }, [])

  const handleUseCurrentLocation = useCallback(async () => {
    try {
      let resolvedLocation = currentLocation

      if (!resolvedLocation) {
        const permission = await Location.getForegroundPermissionsAsync()
        let status = permission.status

        if (status !== 'granted') {
          const requested = await Location.requestForegroundPermissionsAsync()
          status = requested.status
        }

        if (status !== 'granted') {
          Alert.alert(t('location.permissionRequired'))
          return
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })

        resolvedLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        setCurrentLocation(resolvedLocation)
      }

      setOriginInput(t('navigation.currentLocation'))
      setOriginPlace({
        name: t('navigation.currentLocation'),
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
      })
      setOriginAutocomplete([])
      setActiveNavInput(null)
    } catch {
      Alert.alert(t('navigation.error'), t('location.loadFailed'))
    }
  }, [currentLocation, t])

  const fetchDirections = useCallback(async () => {
    let resolvedOrigin = Number.isFinite(originPlace?.latitude) && Number.isFinite(originPlace?.longitude)
      ? {
        latitude: originPlace.latitude,
        longitude: originPlace.longitude,
      }
      : null
    const originPlaceId = typeof originPlace?.placeId === 'string' ? originPlace.placeId.trim() : ''

    let resolvedDestination = Number.isFinite(destinationPlace?.latitude) && Number.isFinite(destinationPlace?.longitude)
      ? {
        latitude: destinationPlace.latitude,
        longitude: destinationPlace.longitude,
      }
      : null
    const destinationPlaceId = typeof destinationPlace?.placeId === 'string' ? destinationPlace.placeId.trim() : ''

    if (!resolvedOrigin && originPlaceId) {
      try {
        const originDetailsResponse = await fetch(
          `${API_BASE_URL}/places/details/${originPlaceId}?language=ko`
        )
        const originDetailsData = await originDetailsResponse.json()
        if (originDetailsData.place && Number.isFinite(originDetailsData.place.latitude) && Number.isFinite(originDetailsData.place.longitude)) {
          resolvedOrigin = {
            latitude: originDetailsData.place.latitude,
            longitude: originDetailsData.place.longitude,
          }
          setOriginPlace((prev) => (prev ? {
            ...prev,
            latitude: originDetailsData.place.latitude,
            longitude: originDetailsData.place.longitude,
          } : prev))
        }
      } catch {
        // Best-effort fallback; keep using current location if available.
      }
    }

    if (!resolvedDestination && destinationPlaceId) {
      try {
        const destinationDetailsResponse = await fetch(
          `${API_BASE_URL}/places/details/${destinationPlaceId}?language=ko`
        )
        const destinationDetailsData = await destinationDetailsResponse.json()
        if (destinationDetailsData.place && Number.isFinite(destinationDetailsData.place.latitude) && Number.isFinite(destinationDetailsData.place.longitude)) {
          resolvedDestination = {
            latitude: destinationDetailsData.place.latitude,
            longitude: destinationDetailsData.place.longitude,
          }
          setDestinationPlace((prev) => (prev ? {
            ...prev,
            latitude: destinationDetailsData.place.latitude,
            longitude: destinationDetailsData.place.longitude,
          } : prev))
        }
      } catch {
        // If details resolution fails, route lookup will fail below with a clear alert.
      }
    }

    const origin = resolvedOrigin || (currentLocation ? {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    } : null)

    if (!origin || !resolvedDestination) {
      Alert.alert(t('navigation.error'), t('navigation.selectBothLocations'))
      return
    }

    if (mapRef.current) {
      const midLat = (origin.latitude + resolvedDestination.latitude) / 2
      const midLng = (origin.longitude + resolvedDestination.longitude) / 2
      const latDelta = Math.abs(origin.latitude - resolvedDestination.latitude) * 1.5
      const lngDelta = Math.abs(origin.longitude - resolvedDestination.longitude) * 1.5
      mapRef.current.animateToRegion({
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max(latDelta, 0.01),
        longitudeDelta: Math.max(lngDelta, 0.01),
      }, 350)
    }

    setIsLoadingRoute(true)
    setRouteData(null)
    setRouteObstacles([])

    try {
      const response = await fetch(`${API_BASE_URL}/directions/walking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_latitude: origin.latitude,
          origin_longitude: origin.longitude,
          destination_latitude: resolvedDestination.latitude,
          destination_longitude: resolvedDestination.longitude,
          avoid_obstacles: true,
          language: 'ko',
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        Alert.alert(t('navigation.error'), data?.detail || t('navigation.routeError'))
        return
      }

      if (data.recommended_route) {
        setRouteData(data.recommended_route)
        setRouteObstacles(data.recommended_route.obstacles || [])

        // 경로가 보이도록 지도 조정
        if (mapRef.current && data.recommended_route.start_location && data.recommended_route.end_location) {
          const start = data.recommended_route.start_location
          const end = data.recommended_route.end_location
          const midLat = (start.lat + end.lat) / 2
          const midLng = (start.lng + end.lng) / 2
          const latDelta = Math.abs(start.lat - end.lat) * 1.5
          const lngDelta = Math.abs(start.lng - end.lng) * 1.5

          mapRef.current.animateToRegion({
            latitude: midLat,
            longitude: midLng,
            latitudeDelta: Math.max(latDelta, 0.01),
            longitudeDelta: Math.max(lngDelta, 0.01),
          }, 500)
        }
      } else {
        Alert.alert(t('navigation.error'), t('navigation.routeError'))
      }
    } catch (error) {
      console.error('Directions error:', error)
      Alert.alert(t('navigation.error'), t('navigation.routeError'))
    } finally {
      setIsLoadingRoute(false)
    }
  }, [originPlace, destinationPlace, currentLocation, t])

  const handleSearch = () => {
    fetchDirections()
  }

  const handleToggleRouteFollow = useCallback(() => {
    if (isFollowingRoute) {
      setIsFollowingRoute(false)
      return
    }

    if (!hasRouteData) {
      Alert.alert(t('navigation.error'), t('navigation.selectBothLocations'))
      return
    }

    if (!currentLocation) {
      Alert.alert(t('navigation.error'), t('location.loadFailed'))
      return
    }

    setIsFollowingRoute(true)
    focusMyLocation()
  }, [isFollowingRoute, hasRouteData, currentLocation, focusMyLocation, t])

  const handleClearRoute = useCallback(() => {
    setIsFollowingRoute(false)
    setRouteData(null)
    setRouteObstacles([])
    setOriginInput('')
    setDestinationInput('')
    setOriginPlace(null)
    setDestinationPlace(null)
  }, [])

  const fetchAutocomplete = useCallback(async (query) => {
    if (!query.trim()) {
      setPlaceAutocomplete([])
      return
    }

    try {
      const locationParam = currentLocation
        ? `&location=${currentLocation.latitude},${currentLocation.longitude}`
        : ''
      const response = await fetch(
        `${API_BASE_URL}/places/autocomplete?input=${encodeURIComponent(query)}${locationParam}&language=ko`
      )
      const data = await response.json()
      if (data.predictions) {
        setPlaceAutocomplete(data.predictions)
      }
    } catch {
      setPlaceAutocomplete([])
    }
  }, [currentLocation])

  const handlePlaceQueryChange = useCallback((text) => {
    setPlaceQuery(text)
    setSelectedPlace(null)

    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current)
    }

    if (!text.trim()) {
      setPlaceAutocomplete([])
      return
    }

    autocompleteTimeoutRef.current = setTimeout(() => {
      fetchAutocomplete(text)
    }, 300)
  }, [fetchAutocomplete])

  const handleSelectPlace = useCallback(async (prediction) => {
    setPlaceQuery(prediction.main_text)
    setPlaceAutocomplete([])
    setIsSearching(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/places/details/${prediction.place_id}?language=ko`
      )
      const data = await response.json()

      if (data.place) {
        const place = data.place
        setSelectedPlace({
          placeId: place.place_id,
          name: place.name,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          phone: place.phone,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          openingHours: place.opening_hours,
          openNow: place.open_now,
          website: place.website,
          googleMapsUrl: place.google_maps_url,
          types: place.types,
        })

        if (mapRef.current) {
          mapRef.current.animateToRegion(
            {
              latitude: place.latitude,
              longitude: place.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            },
            300,
          )
        }
      }
    } catch {
      // Ignore place details fetch errors
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleClearSelectedPlace = useCallback(() => {
    setSelectedPlace(null)
    setPlaceQuery('')
  }, [])

  const handlePlaceSearch = () => {
    if (!placeQuery.trim()) {
      return
    }
    if (placeAutocomplete.length > 0) {
      handleSelectPlace(placeAutocomplete[0])
    }
  }

  useEffect(() => {
    if (activeTab === 'navigation') {
      originRef.current?.focus()
    }
  }, [activeTab])

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      const windowHeight = Dimensions.get('window').height
      const keyboardHeight = event.endCoordinates?.height ?? 0
      const keyboardScreenY = event.endCoordinates?.screenY ?? windowHeight
      const overlapByScreenY = Math.max(0, windowHeight - keyboardScreenY)
      const resolvedKeyboardInset = Math.max(keyboardHeight, overlapByScreenY)
      setKeyboardInset(
        Math.max(0, resolvedKeyboardInset - insets.bottom + ANDROID_KEYBOARD_EXTRA_OFFSET),
      )
    })
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardInset(0)
    })

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [insets.bottom])

  const handleNavPress = (item) => {
    setActiveTab(item)
    if (item === 'home' || item === 'navigation') {
      setMapType('roadmap')
    }
  }

  const isHomeTab = activeTab === 'home'
  const isCameraTab = activeTab === 'camera'
  const isTransitTab = activeTab === 'transit'
  const isNavigationTab = activeTab === 'navigation'
  const isProfileTab = activeTab === 'profile'
  const isBottomPanelTab = isTransitTab || isNavigationTab || isProfileTab
  const androidKeyboardInset = Platform.OS === 'android' ? keyboardInset : 0

  useEffect(() => {
    if (!isNavigationTab || !hasRouteData) {
      setIsFollowingRoute(false)
    }
  }, [isNavigationTab, hasRouteData])

  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: isBottomPanelTab ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !isBottomPanelTab) {
        panelExpandAnim.setValue(0)
        panelMinimizeAnim.setValue(0)
        setIsPanelExpanded(false)
        setIsPanelMinimized(false)
      }
    })
  }, [isBottomPanelTab, collapseAnim, panelExpandAnim, panelMinimizeAnim])

  const navItems = ['home', 'navigation', 'transit', 'profile']
  const activeNavIndex = navItems.indexOf(activeTab)
  // 각 그룹 너비 = (전체 - 카메라버튼영역) / 2, 그룹 내 아이템 = 그룹너비 / 2
  const navGroupWidth = bottomNavWidth > 0 ? (bottomNavWidth - 80) / 2 : 0
  const navIndicatorWidth = navGroupWidth > 0 ? (navGroupWidth - 8) / 2 : 0
  // 카메라 버튼 영역 오프셋 (왼쪽 그룹 끝 ~ 오른쪽 그룹 시작)
  const cameraAreaOffset = 80
  const bottomNavBottom = insets.bottom + 12
  const panelBottomClearance = bottomNavHeight + bottomNavBottom + 8
  const focusButtonBottom = panelBottomClearance + 24
  const locationErrorBottom = bottomNavHeight + bottomNavBottom + 8

  useEffect(() => {
    if (navIndicatorWidth <= 0 || activeNavIndex < 0) {
      return
    }

    // 글로벌 위치 계산: 왼쪽 그룹(0,1)은 그대로, 오른쪽 그룹(2,3)은 카메라 영역 오프셋 추가
    let targetPosition
    if (activeNavIndex <= 1) {
      targetPosition = activeNavIndex * navIndicatorWidth
    } else {
      targetPosition = navGroupWidth + cameraAreaOffset + (activeNavIndex - 2) * navIndicatorWidth
    }

    Animated.spring(navIndicatorAnim, {
      toValue: targetPosition,
      useNativeDriver: true,
      speed: 14,
      bounciness: 2,
    }).start()
  }, [activeNavIndex, navIndicatorWidth, navIndicatorAnim, navGroupWidth, cameraAreaOffset])

  const mapTypeRowAnimatedStyle = {
    opacity: collapseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.6],
    }),
    transform: [
      {
        translateY: collapseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 6],
        }),
      },
    ],
  }

  const animatePanelState = ({ expanded, minimized }) => {
    setIsPanelExpanded(expanded)
    setIsPanelMinimized(minimized)

    Animated.parallel([
      Animated.spring(panelExpandAnim, {
        toValue: expanded ? 1 : 0,
        useNativeDriver: false,
        speed: 20,
        bounciness: 0,
      }),
      Animated.spring(panelMinimizeAnim, {
        toValue: minimized ? 1 : 0,
        useNativeDriver: false,
        speed: 20,
        bounciness: 0,
      }),
    ]).start()
  }

  const handleExpandPanel = () => {
    animatePanelState({ expanded: true, minimized: false })
  }

  const handleCollapsePanel = () => {
    animatePanelState({ expanded: false, minimized: false })
  }

  const handleMinimizePanel = () => {
    animatePanelState({ expanded: false, minimized: true })
  }

  const handleTogglePanel = () => {
    if (isPanelMinimized) {
      handleCollapsePanel()
      return
    }

    animatePanelState({ expanded: !isPanelExpanded, minimized: false })
  }

  const handleBackgroundPress = () => {
    handleNavPress('home')
  }

  const handleBottomNavLayout = (event) => {
    const { width, height } = event.nativeEvent.layout
    setBottomNavWidth(width)
    setBottomNavHeight(height)
  }

  const handleGoogleLogin = async () => {
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'openroute',
        path: 'callback',
      })

      const authUrl = `${API_BASE_URL}/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url)
        const params = Object.fromEntries(url.searchParams.entries())

        if (params?.user) {
          const user = typeof params.user === 'string' ? JSON.parse(params.user) : params.user
          const token = params.access_token

          setUserData(user)
          setAccessToken(token)
          setLoggedIn(true)

          await AsyncStorage.setItem('userData', JSON.stringify(user))
          if (token) {
            await AsyncStorage.setItem('accessToken', token)
          }
        }
      }
    } catch {
      Alert.alert('Login Error', 'Failed to login with Google. Please try again.')
    }
  }

  const handleLogout = async () => {
    setLoggedIn(false)
    setUserData(null)
    setAccessToken(null)
    try {
      await AsyncStorage.removeItem('userData')
      await AsyncStorage.removeItem('accessToken')
    } catch {
      // Ignore persisted login removal failures.
    }
  }

  const handleSelectBadge = (badge) => {
    setSelectedBadge(badge)
    setBadgeModalVisible(true)
  }

  const handleCloseBadgeModal = () => {
    setBadgeModalVisible(false)
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.mapWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
      <View style={[styles.mapWrapper, androidKeyboardInset > 0 ? { marginBottom: androidKeyboardInset } : null]}>
        {isCameraTab ? (
          <CameraTabContent
            styles={styles}
            onClose={() => handleNavPress('home')}
            currentLocation={currentLocation}
            userData={userData}
          />
        ) : (
          <MapTabContent
          styles={styles}
          insets={insets}
          mapRef={mapRef}
          initialRegion={INITIAL_REGION}
          tileUrlTemplate={tileUrlTemplate}
          currentLocation={currentLocation}
          currentHeading={currentHeading}
          isBottomPanelTab={isBottomPanelTab}
          onBackgroundPress={handleBackgroundPress}
          isHomeTab={isHomeTab}
          placeQuery={placeQuery}
          onPlaceQueryChange={handlePlaceQueryChange}
          placeAutocomplete={placeAutocomplete}
          onSelectPlace={handleSelectPlace}
          selectedPlace={selectedPlace}
          onClearSelectedPlace={handleClearSelectedPlace}
          isSearching={isSearching}
          onPlaceSearch={handlePlaceSearch}
          mapTypeRowAnimatedStyle={mapTypeRowAnimatedStyle}
          mapType={mapType}
          setMapType={setMapType}
          collapseAnim={collapseAnim}
          panelExpandAnim={panelExpandAnim}
          panelMinimizeAnim={panelMinimizeAnim}
          isPanelExpanded={isPanelExpanded}
          isPanelMinimized={isPanelMinimized}
          onExpandPanel={handleExpandPanel}
          onCollapsePanel={handleCollapsePanel}
          onMinimizePanel={handleMinimizePanel}
          onTogglePanel={handleTogglePanel}
          panelBottomClearance={panelBottomClearance}
          isTransitTab={isTransitTab}
          isNavigationTab={isNavigationTab}
          isProfileTab={isProfileTab}
          originRef={originRef}
          originInput={originInput}
          onOriginInputChange={handleOriginInputChange}
          destinationInput={destinationInput}
          onDestinationInputChange={handleDestinationInputChange}
          originAutocomplete={originAutocomplete}
          destinationAutocomplete={destinationAutocomplete}
          activeNavInput={activeNavInput}
          setActiveNavInput={setActiveNavInput}
          onSelectNavPlace={handleSelectNavPlace}
          onUseCurrentLocation={handleUseCurrentLocation}
          originPlace={originPlace}
          destinationPlace={destinationPlace}
          routeData={routeData}
          routeObstacles={routeObstacles}
          isLoadingRoute={isLoadingRoute}
          isFollowingRoute={isFollowingRoute}
          onClearRoute={handleClearRoute}
          onToggleRouteFollow={handleToggleRouteFollow}
          setDividerCenterY={setDividerCenterY}
          dividerCenterY={dividerCenterY}
          searchButtonHeight={SEARCH_BUTTON_HEIGHT}
          onSearch={handleSearch}
          hasNavigationInputs={hasNavigationInputs}
          hasRouteData={hasRouteData}
          navigationSummary={navigationSummary}
          focusButtonBottom={focusButtonBottom}
          onFocusMyLocation={focusMyLocation}
          locationError={locationError}
          locationErrorBottom={locationErrorBottom}
          keyboardInset={androidKeyboardInset}
          loggedIn={loggedIn}
          userData={userData}
          badges={badges}
          onOpenLogin={handleGoogleLogin}
          onLogout={handleLogout}
          onSelectBadge={handleSelectBadge}
        />
        )}

        {!isCameraTab && (
          <BottomNavBar
            styles={styles}
            activeTab={activeTab}
            onPressNavItem={handleNavPress}
            bottomNavBottom={bottomNavBottom}
            onLayout={handleBottomNavLayout}
            navIndicatorWidth={navIndicatorWidth}
            navIndicatorAnim={navIndicatorAnim}
            navGroupWidth={navGroupWidth}
            cameraAreaOffset={cameraAreaOffset}
          />
        )}
      </View>
      </KeyboardAvoidingView>

      <StatusBar style={isCameraTab ? 'light' : 'auto'} />

      <AppModals
        styles={styles}
        badgeModalVisible={badgeModalVisible}
        selectedBadge={selectedBadge}
        onCloseBadgeModal={handleCloseBadgeModal}
      />
    </SafeAreaView>
  )
}

export default App



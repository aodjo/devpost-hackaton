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

const DEVICE_LOCALE = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US'
const NORMALIZED_LOCALE = DEVICE_LOCALE.replace('_', '-')
const LOCALE_PARTS = NORMALIZED_LOCALE.split('-')
const TILE_LANGUAGE = NORMALIZED_LOCALE
const TILE_REGION =
  LOCALE_PARTS.length > 1 &&
    /^[A-Za-z]{2}$/.test(LOCALE_PARTS[LOCALE_PARTS.length - 1])
    ? LOCALE_PARTS[LOCALE_PARTS.length - 1].toUpperCase()
    : undefined

const TILE_QUERY = TILE_REGION
  ? `lang=${encodeURIComponent(TILE_LANGUAGE)}&region=${encodeURIComponent(TILE_REGION)}`
  : `lang=${encodeURIComponent(TILE_LANGUAGE)}`
const ANDROID_KEYBOARD_EXTRA_OFFSET = 0

function App() {
  const { t } = useTranslation()
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
  const [obstacles, setObstacles] = useState([])
  const [mapRegion, setMapRegion] = useState(null)
  const obstaclesFetchTimeoutRef = useRef(null)

  const tileUrlTemplate = useMemo(() => {
    const normalizedBase = `${TILE_PROXY_BASE_URL}`.replace(/\/+$/, '')
    return `${normalizedBase}/maps/tiles/{z}/{x}/{y}.png?${TILE_QUERY}&mapType=${encodeURIComponent(mapType)}`
  }, [mapType])

  const navigationSummary = useMemo(
    () => ({
      from: originInput.trim(),
      to: destinationInput.trim(),
      eta: '15:42',
      duration: '24\ubd84',
      distance: '8.4km',
    }),
    [originInput, destinationInput],
  )
  const hasNavigationInputs = navigationSummary.from.length > 0 && navigationSummary.to.length > 0

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

    // 초기 장애물 로드
    const loadInitialObstacles = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/warning/viewport`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sw_latitude: INITIAL_REGION.latitude - INITIAL_REGION.latitudeDelta / 2,
            sw_longitude: INITIAL_REGION.longitude - INITIAL_REGION.longitudeDelta / 2,
            ne_latitude: INITIAL_REGION.latitude + INITIAL_REGION.latitudeDelta / 2,
            ne_longitude: INITIAL_REGION.longitude + INITIAL_REGION.longitudeDelta / 2,
          }),
        })
        const data = await response.json()
        if (data.places && mounted) {
          setObstacles(data.places)
        }
      } catch {
        // Ignore errors
      }
    }
    loadInitialObstacles()

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
      if (obstaclesFetchTimeoutRef.current) {
        clearTimeout(obstaclesFetchTimeoutRef.current)
      }
    }
  }, [])

  const focusMyLocation = () => {
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
  }

  const handleSearch = () => {
    if (!originInput && !destinationInput) {
      return
    }
  }

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

  const fetchObstacles = useCallback(async (region) => {
    if (!region) return

    try {
      const response = await fetch(`${API_BASE_URL}/warning/viewport`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sw_latitude: region.latitude - region.latitudeDelta / 2,
          sw_longitude: region.longitude - region.longitudeDelta / 2,
          ne_latitude: region.latitude + region.latitudeDelta / 2,
          ne_longitude: region.longitude + region.longitudeDelta / 2,
        }),
      })

      const data = await response.json()
      console.log('Obstacles API response:', data)
      if (data.places) {
        setObstacles(data.places)
      }
    } catch (error) {
      console.error('Obstacles fetch error:', error)
    }
  }, [])

  const handleRegionChangeComplete = useCallback((region) => {
    setMapRegion(region)

    if (obstaclesFetchTimeoutRef.current) {
      clearTimeout(obstaclesFetchTimeoutRef.current)
    }

    obstaclesFetchTimeoutRef.current = setTimeout(() => {
      fetchObstacles(region)
    }, 500)
  }, [fetchObstacles])

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
          obstacles={obstacles}
          onRegionChangeComplete={handleRegionChangeComplete}
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
          setOriginInput={setOriginInput}
          destinationInput={destinationInput}
          setDestinationInput={setDestinationInput}
          setDividerCenterY={setDividerCenterY}
          dividerCenterY={dividerCenterY}
          searchButtonHeight={SEARCH_BUTTON_HEIGHT}
          onSearch={handleSearch}
          hasNavigationInputs={hasNavigationInputs}
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



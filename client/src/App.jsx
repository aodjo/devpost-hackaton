import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import * as Location from 'expo-location'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Animated, Dimensions, Keyboard, KeyboardAvoidingView, Platform, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import './i18n'
import { loadStoredLanguage } from './i18n'
import AppModals from './components/AppModals'
import BottomNavBar from './components/BottomNavBar'
import MapTabContent from './components/MapTabContent'
import {
  INITIAL_REGION,
  NAVBAR_HORIZONTAL_PADDING,
  SEARCH_BUTTON_HEIGHT,
} from './constants/appConstants'
import { styles } from './styles/appStyles'

const TILE_PROXY_BASE_URL =
  Constants.expoConfig?.extra?.tileProxyBaseUrl ?? 'http://10.0.2.2:8000'

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
  const [originInput, setOriginInput] = useState('')
  const [destinationInput, setDestinationInput] = useState('')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [currentHeading, setCurrentHeading] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [dividerCenterY, setDividerCenterY] = useState(null)
  const [loginModalVisible, setLoginModalVisible] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
        const storedData = await AsyncStorage.getItem('loginData')
        if (storedData && mounted) {
          const parsedData = JSON.parse(storedData)
          setUsername(parsedData.username)
          setLoggedIn(parsedData.loggedIn)
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

  const handlePlaceSearch = () => {
    if (!placeQuery.trim()) {
      return
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

  const navItemKeys = ['home', 'navigation', 'transit', 'profile']
  const activeNavIndex = Math.max(0, navItemKeys.indexOf(activeTab))
  const navIndicatorWidth =
    bottomNavWidth > 0
      ? (bottomNavWidth - NAVBAR_HORIZONTAL_PADDING * 2) / navItemKeys.length
      : 0
  const bottomNavBottom = insets.bottom + 12
  const panelBottomClearance = bottomNavHeight + bottomNavBottom + 8
  const focusButtonBottom = panelBottomClearance + 24
  const locationErrorBottom = bottomNavHeight + bottomNavBottom + 8

  useEffect(() => {
    if (navIndicatorWidth <= 0) {
      return
    }

    Animated.spring(navIndicatorAnim, {
      toValue: activeNavIndex * navIndicatorWidth,
      useNativeDriver: true,
      speed: 18,
      bounciness: 0,
    }).start()
  }, [activeNavIndex, navIndicatorWidth, navIndicatorAnim])

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

  const handleOpenLoginModal = () => {
    setLoginModalVisible(true)
  }

  const handleCancelLogin = () => {
    setLoginModalVisible(false)
    setUsername('')
    setPassword('')
  }

  const handleSubmitLogin = async () => {
    setLoggedIn(true)
    setLoginModalVisible(false)
    try {
      await AsyncStorage.setItem('loginData', JSON.stringify({ username, loggedIn: true }))
    } catch {
      // Ignore persisted login write failures.
    }
  }

  const handleLogout = async () => {
    setLoggedIn(false)
    setUsername('')
    setPassword('')
    try {
      await AsyncStorage.removeItem('loginData')
    } catch {
      // Ignore persisted login removal failures.
    }
  }

  const handleCancelChangePassword = () => {
    setChangePasswordModalVisible(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleSubmitChangePassword = () => {
    if (newPassword === confirmPassword) {
      handleCancelChangePassword()
      return
    }

    Alert.alert(t('profile.error'), t('profile.passwordMismatch'))
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
          setPlaceQuery={setPlaceQuery}
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
          username={username}
          badges={badges}
          onOpenLogin={handleOpenLoginModal}
          onLogout={handleLogout}
          onSelectBadge={handleSelectBadge}
        />

        <BottomNavBar
          styles={styles}
          navItemKeys={navItemKeys}
          activeTab={activeTab}
          onPressNavItem={handleNavPress}
          bottomNavBottom={bottomNavBottom}
          onLayout={handleBottomNavLayout}
          navIndicatorWidth={navIndicatorWidth}
          navIndicatorAnim={navIndicatorAnim}
        />
      </View>
      </KeyboardAvoidingView>

      <StatusBar style="auto" />

      <AppModals
        styles={styles}
        loginModalVisible={loginModalVisible}
        changePasswordModalVisible={changePasswordModalVisible}
        badgeModalVisible={badgeModalVisible}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        currentPassword={currentPassword}
        setCurrentPassword={setCurrentPassword}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        selectedBadge={selectedBadge}
        onCancelLogin={handleCancelLogin}
        onSubmitLogin={handleSubmitLogin}
        onCancelChangePassword={handleCancelChangePassword}
        onSubmitChangePassword={handleSubmitChangePassword}
        onCloseBadgeModal={handleCloseBadgeModal}
      />
    </SafeAreaView>
  )
}

export default App



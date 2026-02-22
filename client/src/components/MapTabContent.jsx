import { useMemo, useState } from 'react'
import {
  Animated,
  Image,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '../i18n'
import Constants from 'expo-constants'

const NAVIGATION_STEP_ICONS = ['trip-origin', 'turn-right', 'straight', 'flag']

// Google Polyline 디코딩 함수
function decodePolyline(encoded) {
  const points = []
  let index = 0, lat = 0, lng = 0

  while (index < encoded.length) {
    let shift = 0, result = 0, byte
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : (result >> 1)

    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : (result >> 1)

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
  }
  return points
}
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0'
const GITHUB_URL = 'https://github.com/aodjo/devpost-hackaton'
const GOOGLE_ICON_URI = 'https://img.icons8.com/?size=100&id=17949&format=png&color=000000'

function ProfilePanelContent({
  t,
  styles,
  loggedIn,
  userData,
  badges,
  onOpenLogin,
  onLogout,
  onSelectBadge,
}) {
  const { i18n } = useTranslation()
  const currentLang = i18n.language
  const [fontSize, setFontSize] = useState('medium')

  const handleLanguageChange = async (lang) => {
    await changeLanguage(lang)
  }

  const openGitHub = () => {
    Linking.openURL(GITHUB_URL)
  }

  return (
    <View style={styles.profilePanel}>
      {/* 프로필 섹션 */}
      <View style={styles.profileSectionCard}>
        <View style={styles.profileHeader}>
          {loggedIn && userData?.profile_image ? (
            <Image source={{ uri: userData.profile_image }} style={styles.profileAvatarImage} />
          ) : (
            <View style={styles.profileAvatar}>
              <MaterialIcons name="person" size={32} color="#94a3b8" />
            </View>
          )}
          <View style={styles.profileInfo}>
            {loggedIn && userData ? (
              <>
                <Text style={styles.profileUsername}>{userData.username}</Text>
                <Text style={styles.profileEmail}>{userData.email}</Text>
              </>
            ) : (
              <Text style={styles.profileLoginHint}>{t('profile.loginPrompt')}</Text>
            )}
          </View>
        </View>
        {loggedIn ? (
          <View style={styles.profileButtonRow}>
            <Pressable style={styles.profileEditButton}>
              <MaterialIcons name="edit" size={16} color="#475569" />
              <Text style={styles.profileEditButtonText}>{t('profile.editProfile')}</Text>
            </Pressable>
            <Pressable style={styles.profileLogoutButton} onPress={onLogout}>
              <MaterialIcons name="logout" size={16} color="#ef4444" />
              <Text style={styles.profileLogoutButtonText}>{t('profile.logout')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.googleLoginButton} onPress={onOpenLogin}>
            <Image source={{ uri: GOOGLE_ICON_URI }} style={styles.googleIcon} />
            <Text style={styles.googleLoginButtonText}>{t('profile.loginWithGoogle')}</Text>
          </Pressable>
        )}
      </View>

      {/* 설정 섹션 */}
      <View style={styles.profileSectionCard}>
        <Text style={styles.profileSectionTitle}>{t('profile.settings')}</Text>

        {/* 폰트 크기 */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t('profile.fontSize')}</Text>
          <View style={styles.settingButtons}>
            {['small', 'medium', 'large'].map((size) => (
              <Pressable
                key={size}
                style={[styles.settingButton, fontSize === size && styles.settingButtonActive]}
                onPress={() => setFontSize(size)}
              >
                <Text style={[styles.settingButtonText, fontSize === size && styles.settingButtonTextActive]}>
                  {t(`profile.fontSizes.${size}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 언어 */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t('profile.language')}</Text>
          <View style={styles.settingButtons}>
            <Pressable
              style={[styles.settingButton, currentLang === 'ko' && styles.settingButtonActive]}
              onPress={() => handleLanguageChange('ko')}
            >
              <Text style={[styles.settingButtonText, currentLang === 'ko' && styles.settingButtonTextActive]}>
                {t('language.korean')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.settingButton, currentLang === 'en' && styles.settingButtonActive]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text style={[styles.settingButtonText, currentLang === 'en' && styles.settingButtonTextActive]}>
                {t('language.english')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* 메달 섹션 */}
      {loggedIn && badges.length > 0 ? (
        <View style={styles.profileSectionCard}>
          <Text style={styles.profileSectionTitle}>{t('profile.medals')}</Text>
          <View style={styles.medalsGrid}>
            {badges.map((badge) => (
              <Pressable key={badge.id} style={styles.medalItem} onPress={() => onSelectBadge(badge)}>
                <View style={styles.medalIcon}>
                  <Image source={badge.image} style={styles.medalImage} />
                </View>
                <Text style={styles.medalName}>{badge.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* 앱 정보 섹션 */}
      <View style={styles.profileSectionCard}>
        <Text style={styles.profileSectionTitle}>{t('profile.appInfo')}</Text>

        <View style={styles.appInfoRow}>
          <Text style={styles.appInfoLabel}>{t('profile.version')}</Text>
          <Text style={styles.appInfoValue}>{APP_VERSION}</Text>
        </View>

        <Pressable style={styles.appInfoRow} onPress={openGitHub}>
          <Text style={styles.appInfoLabel}>GitHub</Text>
          <View style={styles.appInfoLink}>
            <Text style={styles.appInfoLinkText}>aodjo/devpost-hackaton</Text>
            <MaterialIcons name="open-in-new" size={14} color="#3b82f6" />
          </View>
        </Pressable>

        <Pressable style={styles.appInfoRow}>
          <Text style={styles.appInfoLabel}>{t('profile.openSource')}</Text>
          <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
        </Pressable>
      </View>
    </View>
  )
}

function MapTabContent({
  // Shared
  styles,
  insets,

  // Map
  mapRef,
  initialRegion,
  tileUrlTemplate,
  currentLocation,
  currentHeading,
  isBottomPanelTab,
  onBackgroundPress,

  // Home search
  isHomeTab,
  placeQuery,
  onPlaceQueryChange,
  placeAutocomplete,
  onSelectPlace,
  selectedPlace,
  onClearSelectedPlace,
  isSearching,
  onPlaceSearch,

  // Map type controls
  mapTypeRowAnimatedStyle,
  mapType,
  setMapType,

  // Bottom sheet state/animation
  collapseAnim,
  panelExpandAnim,
  panelMinimizeAnim,
  isPanelExpanded,
  isPanelMinimized,
  onExpandPanel,
  onCollapsePanel,
  onMinimizePanel,
  onTogglePanel,
  panelBottomClearance,

  // Transit panel
  isTransitTab,

  // Navigation panel
  isNavigationTab,

  // Profile panel
  isProfileTab,
  loggedIn,
  userData,
  badges,
  onOpenLogin,
  onLogout,
  onSelectBadge,
  originRef,
  originInput,
  onOriginInputChange,
  destinationInput,
  onDestinationInputChange,
  originAutocomplete,
  destinationAutocomplete,
  activeNavInput,
  setActiveNavInput,
  onSelectNavPlace,
  onUseCurrentLocation,
  originPlace,
  destinationPlace,
  routeData,
  routeObstacles,
  isLoadingRoute,
  isFollowingRoute,
  onClearRoute,
  onToggleRouteFollow,
  setDividerCenterY,
  dividerCenterY,
  searchButtonHeight,
  onSearch,
  hasNavigationInputs,
  hasRouteData,
  navigationSummary,

  // Floating controls + feedback
  focusButtonBottom,
  onFocusMyLocation,
  locationError,
  locationErrorBottom,

  // Keyboard
  keyboardInset = 0,
}) {
  const { t } = useTranslation()
  const topPanelTop = insets.top + 12
  const [mapTypeRowBottom, setMapTypeRowBottom] = useState(topPanelTop + 44)
  const { height: screenHeight } = useWindowDimensions()
  const hiddenTranslateY = screenHeight
  const collapsedTranslateY = Math.max(180, Math.round(screenHeight * 0.42))
  const expandedTranslateY = mapTypeRowBottom + 8
  const minimizedPeekHeight = panelBottomClearance + 48
  const minimizedTranslateY = Math.max(
    collapsedTranslateY + 48,
    screenHeight - minimizedPeekHeight,
  )

  // 경로 좌표 계산
  const routeCoordinates = useMemo(() => {
    if (!routeData) return []

    if (typeof routeData.overview_polyline === 'string' && routeData.overview_polyline.length > 0) {
      const overviewCoordinates = decodePolyline(routeData.overview_polyline)
      if (overviewCoordinates.length > 1) {
        return overviewCoordinates
      }
    }

    if (Array.isArray(routeData.steps) && routeData.steps.length > 0) {
      const stepCoordinates = routeData.steps.flatMap((step, index) => {
        if (!step?.polyline || typeof step.polyline !== 'string') return []
        const decoded = decodePolyline(step.polyline)
        if (decoded.length === 0) return []
        return index === 0 ? decoded : decoded.slice(1)
      })
      if (stepCoordinates.length > 1) {
        return stepCoordinates
      }
    }

    return []
  }, [routeData])

  // 패널이 화면 상단을 넘어가지 않도록 제한
  const maxKeyboardOffset = collapsedTranslateY - expandedTranslateY
  const keyboardOffset = keyboardInset > 0 ? -Math.min(keyboardInset, maxKeyboardOffset) : 0

  // 내비게이션 힌트 표시 여부
  const hasOriginAutocomplete = originAutocomplete.length > 0
  const hasDestinationAutocomplete = destinationAutocomplete.length > 0
  const hasNavigationTextInput = originInput.trim().length > 0 || destinationInput.trim().length > 0
  const isEditingNavigationInput = activeNavInput === 'origin' || activeNavInput === 'destination'
  const hasOpenAutocomplete = hasOriginAutocomplete || hasDestinationAutocomplete
  const followButtonLabel = isFollowingRoute
    ? t('navigation.stopFollowRoute', { defaultValue: '따라가기 중지' })
    : t('navigation.followRoute', { defaultValue: '따라가기' })
  const showNavigationHint = isNavigationTab
    && !hasNavigationInputs
    && !isEditingNavigationInput
    && !hasNavigationTextInput
    && !hasOpenAutocomplete

  // 내비게이션 단계
  const navigationSteps = [
    { id: 'step-1', icon: NAVIGATION_STEP_ICONS[0], text: t('navigation.steps.step1') },
    { id: 'step-2', icon: NAVIGATION_STEP_ICONS[1], text: t('navigation.steps.step2') },
    { id: 'step-3', icon: NAVIGATION_STEP_ICONS[2], text: t('navigation.steps.step3') },
    { id: 'step-4', icon: NAVIGATION_STEP_ICONS[3], text: t('navigation.steps.step4') },
  ]

  const panelPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isBottomPanelTab,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          isBottomPanelTab &&
          Math.abs(gestureState.dy) > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderRelease: (_, gestureState) => {
          const absDy = Math.abs(gestureState.dy)
          const absDx = Math.abs(gestureState.dx)
          const swipeThreshold = 12
          const strongSwipeThreshold = 96
          const velocityThreshold = 0.25
          const strongVelocityThreshold = 0.9

          if (absDy < 6 && absDx < 6) {
            onTogglePanel()
            return
          }

          if (gestureState.dy < -swipeThreshold || gestureState.vy < -velocityThreshold) {
            if (isPanelMinimized) {
              onCollapsePanel()
              return
            }

            onExpandPanel()
            return
          }

          if (gestureState.dy > swipeThreshold || gestureState.vy > velocityThreshold) {
            if (isPanelExpanded) {
              if (
                gestureState.dy > strongSwipeThreshold ||
                gestureState.vy > strongVelocityThreshold
              ) {
                onMinimizePanel()
                return
              }

              onCollapsePanel()
              return
            }

            onMinimizePanel()
            return
          }

          if (isPanelExpanded) {
            onCollapsePanel()
            return
          }

          if (isPanelMinimized) {
            onCollapsePanel()
            return
          }

          if (!isPanelMinimized) {
            onMinimizePanel()
          }
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [
      isBottomPanelTab,
      isPanelExpanded,
      isPanelMinimized,
      onExpandPanel,
      onCollapsePanel,
      onMinimizePanel,
      onTogglePanel,
    ],
  )

  const panelBaseTranslateY = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [hiddenTranslateY, collapsedTranslateY],
  })
  const panelExpandOffset = panelExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, expandedTranslateY - collapsedTranslateY],
  })
  const panelMinimizeOffset = panelMinimizeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, minimizedTranslateY - collapsedTranslateY],
  })

  const panelTranslateY = Animated.add(
    Animated.add(panelBaseTranslateY, panelExpandOffset),
    panelMinimizeOffset,
  )
  const routeStartCoordinate = Number.isFinite(routeData?.start_location?.lat) && Number.isFinite(routeData?.start_location?.lng)
    ? {
      latitude: routeData.start_location.lat,
      longitude: routeData.start_location.lng,
    }
    : null
  const routeEndCoordinate = Number.isFinite(routeData?.end_location?.lat) && Number.isFinite(routeData?.end_location?.lng)
    ? {
      latitude: routeData.end_location.lat,
      longitude: routeData.end_location.lng,
    }
    : null
  const navigationOriginCoordinate = Number.isFinite(originPlace?.latitude) && Number.isFinite(originPlace?.longitude)
    ? {
      latitude: originPlace.latitude,
      longitude: originPlace.longitude,
    }
    : currentLocation
      ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      }
      : routeStartCoordinate
  const navigationDestinationCoordinate = Number.isFinite(destinationPlace?.latitude) && Number.isFinite(destinationPlace?.longitude)
    ? {
      latitude: destinationPlace.latitude,
      longitude: destinationPlace.longitude,
    }
    : routeEndCoordinate

  return (
    <>
      {/* Base map + live location marker */}
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        initialRegion={initialRegion}
        onPress={isBottomPanelTab && !isPanelExpanded ? onBackgroundPress : undefined}
      >
        <UrlTile key={tileUrlTemplate} urlTemplate={tileUrlTemplate} maximumZ={22} shouldReplaceMapContent />
        {currentLocation ? (
          <Marker
            coordinate={currentLocation}
            tracksViewChanges={true}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}
          >
            <View style={styles.locationMarkerContainer}>
              {currentHeading != null ? (
                <View
                  style={[
                    styles.headingConeWrapper,
                    { transform: [{ rotate: `${currentHeading}deg` }] },
                  ]}
                >
                  <View style={styles.headingConeShape} />
                </View>
              ) : null}
              <View style={styles.locationDotOuter}>
                <View style={styles.locationDotInner} />
              </View>
            </View>
          </Marker>
        ) : null}
        {selectedPlace ? (
          <Marker
            coordinate={{
              latitude: selectedPlace.latitude,
              longitude: selectedPlace.longitude,
            }}
            title={selectedPlace.name}
            description={selectedPlace.address}
          >
            <View style={styles.selectedPlaceMarker}>
              <MaterialIcons name="place" size={36} color="#ef4444" />
            </View>
          </Marker>
        ) : null}

        {/* 경로 폴리라인 */}
        {routeCoordinates.length > 0 ? (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#3b82f6"
            strokeWidth={5}
            lineDashPattern={[0]}
          />
        ) : null}
        {/* 목적지 마커 */}
        {navigationOriginCoordinate && isNavigationTab ? (
          <Marker
            coordinate={navigationOriginCoordinate}
            title={originPlace?.name || t('navigation.currentLocation')}
          >
            <View style={styles.originMarker}>
              <MaterialIcons name="flag" size={28} color="#ef4444" />
            </View>
          </Marker>
        ) : null}
        {navigationDestinationCoordinate && isNavigationTab ? (
          <Marker
            coordinate={navigationDestinationCoordinate}
            title={destinationPlace?.name || t('search.destinationPlaceholder')}
          >
            <View style={styles.destinationMarker}>
              <MaterialIcons name="flag" size={28} color="#22c55e" />
            </View>
          </Marker>
        ) : null}

        {/* 장애물 마커 */}
        {routeObstacles.map((obstacle) => (
          <Marker
            key={`obstacle-${obstacle.id}`}
            coordinate={{
              latitude: obstacle.latitude,
              longitude: obstacle.longitude,
            }}
            title={obstacle.name}
            description={obstacle.description}
          >
            <View style={styles.obstacleMarker}>
              <MaterialIcons
                name={obstacle.type === 'Stair' ? 'stairs' : obstacle.type === 'EV' ? 'elevator' : 'warning'}
                size={20}
                color="#fff"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Top overlay: home search + map type switch */}
      <View style={[styles.topPanel, { top: topPanelTop }]}>
        {isHomeTab ? (
          <View style={styles.searchContainer}>
            <View style={[styles.inputCard, styles.homeInputCard]}>
              <TextInput
                style={styles.homeInput}
                value={placeQuery}
                onChangeText={onPlaceQueryChange}
                placeholder={t('search.placeSearchPlaceholder')}
                placeholderTextColor="#475569"
                returnKeyType="search"
                onSubmitEditing={onPlaceSearch}
              />
              {placeQuery.length > 0 ? (
                <Pressable
                  style={styles.clearButton}
                  onPress={onClearSelectedPlace}
                  accessibilityRole="button"
                  accessibilityLabel="Clear"
                >
                  <MaterialIcons name="close" size={18} color="#94a3b8" />
                </Pressable>
              ) : null}
              <Pressable
                style={styles.homeSearchButton}
                onPress={onPlaceSearch}
                accessibilityRole="button"
                accessibilityLabel={t('search.search')}
              >
                {isSearching ? (
                  <MaterialIcons name="hourglass-empty" size={20} color="#f8fafc" />
                ) : (
                  <MaterialIcons name="search" size={20} color="#f8fafc" />
                )}
              </Pressable>
            </View>

            {/* Autocomplete dropdown */}
            {placeAutocomplete.length > 0 ? (
              <View style={styles.autocompleteDropdown}>
                {placeAutocomplete.map((prediction) => (
                  <Pressable
                    key={prediction.place_id}
                    style={styles.autocompleteItem}
                    onPress={() => onSelectPlace(prediction)}
                  >
                    <MaterialIcons name="place" size={18} color="#64748b" />
                    <View style={styles.autocompleteTextContainer}>
                      <Text style={styles.autocompleteMainText}>{prediction.main_text}</Text>
                      <Text style={styles.autocompleteSecondaryText}>{prediction.secondary_text}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Animated.View
          style={[styles.mapTypeRow, mapTypeRowAnimatedStyle]}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout
            setMapTypeRowBottom(topPanelTop + y + height)
          }}
        >
          <Pressable
            style={[styles.mapTypeButton, mapType === 'roadmap' && styles.mapTypeButtonActive]}
            onPress={() => setMapType('roadmap')}
          >
            <Text style={[styles.mapTypeButtonText, mapType === 'roadmap' && styles.mapTypeButtonTextActive]}>
              {t('map.road')}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.mapTypeButton, mapType === 'satellite' && styles.mapTypeButtonActive]}
            onPress={() => setMapType('satellite')}
          >
            <Text
              style={[styles.mapTypeButtonText, mapType === 'satellite' && styles.mapTypeButtonTextActive]}
            >
              {t('map.satellite')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Collapsible bottom panel: transit or navigation */}
      <Animated.View
        style={[
          styles.collapsiblePanel,
          {
            transform: [
              { translateY: panelTranslateY },
              { translateY: keyboardOffset },
            ],
          },
        ]}
        pointerEvents={isBottomPanelTab ? 'auto' : 'none'}
      >
        <View
          {...panelPanResponder.panHandlers}
          style={styles.panelHandleArea}
        >
          <View style={styles.panelHandle} />
        </View>

        <ScrollView
          style={styles.collapsibleContent}
          contentContainerStyle={[
            styles.collapsibleContentInner,
            { paddingBottom: panelBottomClearance },
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* Transit tab content */}
          {isTransitTab ? (
            <Text style={styles.panelTitle}>{t('panel.transit')}</Text>
          ) : null}

          {/* Navigation tab content */}
          {isNavigationTab ? (
            <View style={styles.navigationPanel}>
              <Text style={styles.panelTitle}>{t('panel.navigation')}</Text>
              <View style={styles.navigationInputCard}>
                <View
                  style={[
                    styles.inputWithAutocomplete,
                    activeNavInput === 'origin' && styles.inputWithAutocompleteActive,
                  ]}
                >
                  <View style={styles.navigationInputRow}>
                    <MaterialIcons name="flag" size={18} color="#ef4444" style={styles.navigationInputIcon} />
                    <TextInput
                      ref={originRef}
                      style={[styles.input, styles.navigationInputText]}
                      value={originInput}
                      onChangeText={onOriginInputChange}
                      onFocus={() => setActiveNavInput('origin')}
                      placeholder={t('search.originPlaceholder')}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  {activeNavInput === 'origin' && !originInput.trim() ? (
                    <Pressable style={styles.currentLocationButton} onPressIn={onUseCurrentLocation} hitSlop={10}>
                      <MaterialIcons name="my-location" size={16} color="#3b82f6" />
                      <Text style={styles.currentLocationText}>{t('navigation.useCurrentLocation')}</Text>
                    </Pressable>
                  ) : null}
                  {activeNavInput === 'origin' && originAutocomplete.length > 0 ? (
                    <View style={styles.navAutocompleteDropdown}>
                      {originAutocomplete.slice(0, 4).map((prediction) => (
                        <Pressable
                          key={prediction.place_id}
                          style={styles.navAutocompleteItem}
                          onPress={() => onSelectNavPlace(prediction, 'origin')}
                        >
                          <MaterialIcons name="place" size={16} color="#64748b" />
                          <View style={styles.navAutocompleteTextContainer}>
                            <Text style={styles.navAutocompleteMainText} numberOfLines={1} ellipsizeMode="tail">
                              {prediction.main_text}
                            </Text>
                            <Text style={styles.navAutocompleteSecondaryText} numberOfLines={1} ellipsizeMode="tail">
                              {prediction.secondary_text}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View
                  style={styles.inputDivider}
                  onLayout={(event) => {
                    const { y, height } = event.nativeEvent.layout
                    setDividerCenterY(y + height / 2)
                  }}
                />
                <View
                  style={[
                    styles.inputWithAutocomplete,
                    activeNavInput === 'destination' && styles.inputWithAutocompleteActive,
                  ]}
                >
                  <View style={styles.navigationInputRow}>
                    <MaterialIcons name="flag" size={18} color="#22c55e" style={styles.navigationInputIcon} />
                    <TextInput
                      style={[styles.input, styles.navigationInputText]}
                      value={destinationInput}
                      onChangeText={onDestinationInputChange}
                      onFocus={() => setActiveNavInput('destination')}
                      placeholder={t('search.destinationPlaceholder')}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  {activeNavInput === 'destination' && destinationAutocomplete.length > 0 ? (
                    <View style={styles.navAutocompleteDropdown}>
                      {destinationAutocomplete.slice(0, 4).map((prediction) => (
                        <Pressable
                          key={prediction.place_id}
                          style={styles.navAutocompleteItem}
                          onPress={() => onSelectNavPlace(prediction, 'destination')}
                        >
                          <MaterialIcons name="place" size={16} color="#64748b" />
                          <View style={styles.navAutocompleteTextContainer}>
                            <Text style={styles.navAutocompleteMainText} numberOfLines={1} ellipsizeMode="tail">
                              {prediction.main_text}
                            </Text>
                            <Text style={styles.navAutocompleteSecondaryText} numberOfLines={1} ellipsizeMode="tail">
                              {prediction.secondary_text}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
                <Pressable
                  style={[
                    styles.searchButton,
                    dividerCenterY == null
                      ? styles.searchButtonFallback
                      : { top: dividerCenterY - searchButtonHeight / 2 },
                    isLoadingRoute && styles.searchButtonLoading,
                  ]}
                  onPress={onSearch}
                  disabled={isLoadingRoute}
                  accessibilityRole="button"
                  accessibilityLabel={t('search.directions')}
                >
                  <Text style={styles.searchButtonText}>{t('search.directions')}</Text>
                </Pressable>
              </View>

              {hasRouteData ? (
                <>
                  <View style={styles.navigationHeaderRow}>
                    <Text style={styles.navigationPanelTitle}>{t('navigation.panelTitle')}</Text>
                    <View style={styles.navigationDistancePill}>
                      <Text style={styles.navigationDistancePillText}>
                        {navigationSummary.distance}
                      </Text>
                    </View>
                    {!navigationSummary.isAccessible ? (
                      <View style={styles.obstacleWarningPill}>
                        <MaterialIcons name="warning" size={14} color="#fff" />
                        <Text style={styles.obstacleWarningText}>
                          {t('navigation.obstaclesFound', { count: navigationSummary.obstacleCount })}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.navigationMetaRow}>
                    <View style={styles.navigationMetaItem}>
                      <Text style={styles.navigationMetaLabel}>{t('navigation.eta')}</Text>
                      <Text style={styles.navigationMetaValue}>{navigationSummary.eta}</Text>
                    </View>
                    <View style={styles.navigationMetaDivider} />
                    <View style={styles.navigationMetaItem}>
                      <Text style={styles.navigationMetaLabel}>{t('navigation.duration')}</Text>
                      <Text style={styles.navigationMetaValue}>{navigationSummary.duration}</Text>
                    </View>
                  </View>

                  <View style={styles.navigationRouteCard}>
                    <Text style={styles.navigationRouteFrom}>{navigationSummary.from}</Text>
                    <View style={styles.navigationRouteLine} />
                    <Text style={styles.navigationRouteTo}>{navigationSummary.to}</Text>
                  </View>

                  {/* 실제 경로 단계 표시 */}
                  {routeData?.steps?.length > 0 ? (
                    <View style={styles.navigationSteps}>
                      {routeData.steps.slice(0, 5).map((step, index) => (
                        <View key={`step-${index}`} style={styles.navigationStepRow}>
                          <MaterialIcons
                            name={step.maneuver?.includes('left') ? 'turn-left' : step.maneuver?.includes('right') ? 'turn-right' : index === 0 ? 'trip-origin' : index === routeData.steps.length - 1 ? 'flag' : 'straight'}
                            size={17}
                            color="#334155"
                          />
                          <View style={styles.navigationStepContent}>
                            <Text style={styles.navigationStepText}>
                              {step.instruction.replace(/<[^>]*>/g, '')}
                            </Text>
                            <Text style={styles.navigationStepDistance}>{step.distance}</Text>
                          </View>
                        </View>
                      ))}
                      {routeData.steps.length > 5 ? (
                        <Text style={styles.navigationMoreSteps}>
                          +{routeData.steps.length - 5} {t('navigation.moreSteps')}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={styles.navigationButtonRow}>
                    <Pressable style={styles.navigationClearButton} onPress={onClearRoute}>
                      <MaterialIcons name="close" size={18} color="#64748b" />
                      <Text style={styles.navigationClearButtonText}>{t('navigation.clearRoute')}</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.navigationStartButton,
                        isFollowingRoute && styles.navigationStartButtonActive,
                      ]}
                      onPress={onToggleRouteFollow}
                    >
                      <MaterialIcons
                        name={isFollowingRoute ? 'gps-off' : 'navigation'}
                        size={18}
                        color="#f8fafc"
                      />
                      <Text style={styles.navigationStartButtonText}>{followButtonLabel}</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {/* Profile tab content */}
          {isProfileTab ? (
            <>
              <Text style={styles.panelTitle}>{t('panel.profile')}</Text>
              <ProfilePanelContent
                t={t}
                styles={styles}
                loggedIn={loggedIn}
                userData={userData}
                badges={badges}
                onOpenLogin={onOpenLogin}
                onLogout={onLogout}
                onSelectBadge={onSelectBadge}
              />
            </>
          ) : null}
        </ScrollView>

        {/* 대중교통 메시지 - 패널의 보이는 영역 기준으로 중앙 정렬 */}
        {isTransitTab ? (
          <View
            style={{
              position: 'absolute',
              top: 32,
              left: 0,
              right: 0,
              height: screenHeight - collapsedTranslateY - 32 - panelBottomClearance,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            pointerEvents="none"
          >
            <FontAwesome5 name="clock" size={44} color="#334155" />
            <Text style={styles.transitUnavailableText}>{t('transit.unavailable')}</Text>
          </View>
        ) : null}

        {/* 내비게이션 힌트 - 패널의 보이는 영역 기준으로 중앙 정렬 */}
        {showNavigationHint ? (
          <View
            style={{
              position: 'absolute',
              top: 140,
              left: 0,
              right: 0,
              height: screenHeight - collapsedTranslateY - 140 - panelBottomClearance,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            pointerEvents="none"
          >
            <View style={styles.navigationHintContent}>
              <FontAwesome5 name="route" size={44} color="#334155" />
              <Text style={styles.navigationHintText}>{t('navigation.routeHint')}</Text>
            </View>
          </View>
        ) : null}
      </Animated.View>

      {/* Place info panel */}
      {selectedPlace && isHomeTab ? (
        <View style={[styles.placeInfoPanel, { bottom: panelBottomClearance }]}>
          {/* Rating badge at top */}
          {selectedPlace.rating ? (
            <View style={styles.placeInfoRatingBadge}>
              <MaterialIcons name="star" size={16} color="#fff" />
              <Text style={styles.placeInfoRatingBadgeText}>{selectedPlace.rating}</Text>
              {selectedPlace.userRatingsTotal ? (
                <Text style={styles.placeInfoRatingBadgeCount}>({selectedPlace.userRatingsTotal})</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.placeInfoHeader}>
            <Text style={styles.placeInfoName}>{selectedPlace.name}</Text>
            <Pressable style={styles.placeInfoCloseButton} onPress={onClearSelectedPlace}>
              <MaterialIcons name="close" size={20} color="#64748b" />
            </Pressable>
          </View>

          <Text style={styles.placeInfoAddress}>{selectedPlace.address}</Text>

          {selectedPlace.openNow !== undefined ? (
            <View style={styles.placeInfoOpenStatus}>
              <View style={[styles.placeInfoOpenDot, selectedPlace.openNow ? styles.placeInfoOpenDotOpen : styles.placeInfoOpenDotClosed]} />
              <Text style={[styles.placeInfoOpenText, selectedPlace.openNow ? styles.placeInfoOpenTextOpen : styles.placeInfoOpenTextClosed]}>
                {selectedPlace.openNow ? t('search.openNow') : t('search.closed')}
              </Text>
            </View>
          ) : null}

          <View style={styles.placeInfoActions}>
            {selectedPlace.phone ? (
              <Pressable style={styles.placeInfoActionButton} onPress={() => Linking.openURL(`tel:${selectedPlace.phone}`)}>
                <MaterialIcons name="phone" size={18} color="#3b82f6" />
                <Text style={styles.placeInfoActionText}>{t('search.call')}</Text>
              </Pressable>
            ) : null}
            {selectedPlace.googleMapsUrl ? (
              <Pressable style={styles.placeInfoActionButton} onPress={() => Linking.openURL(selectedPlace.googleMapsUrl)}>
                <MaterialIcons name="directions" size={18} color="#3b82f6" />
                <Text style={styles.placeInfoActionText}>{t('search.directions')}</Text>
              </Pressable>
            ) : null}
            {selectedPlace.website ? (
              <Pressable style={styles.placeInfoActionButton} onPress={() => Linking.openURL(selectedPlace.website)}>
                <MaterialIcons name="language" size={18} color="#3b82f6" />
                <Text style={styles.placeInfoActionText}>{t('search.website')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Floating "focus my location" button */}
      <Pressable
        style={[
          styles.focusButton,
          { bottom: selectedPlace && isHomeTab ? panelBottomClearance + 180 : focusButtonBottom },
        ]}
        onPress={onFocusMyLocation}
        accessibilityRole="button"
        accessibilityLabel={t('map.focusMyLocation')}
      >
        <MaterialIcons name="gps-fixed" size={22} color="#f8fafc" />
      </Pressable>

      {/* Location permission / load error message */}
      {locationError ? (
        <Text style={[styles.locationError, { bottom: locationErrorBottom }]}>{locationError}</Text>
      ) : null}
    </>
  )
}

export default MapTabContent

import { useMemo, useState } from 'react'
import {
  Animated,
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
import MapView, { Marker, UrlTile } from 'react-native-maps'

function MapTabContent({
  // Shared
  styles,
  labels,
  insets,

  // Map
  mapRef,
  initialRegion,
  tileUrlTemplate,
  currentLocation,
  isBottomPanelTab,
  onBackgroundPress,

  // Home search
  isHomeTab,
  placeQuery,
  setPlaceQuery,
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
  transitType,
  setTransitType,
  transitRoutes,

  // Navigation panel
  isNavigationTab,
  originRef,
  originInput,
  setOriginInput,
  destinationInput,
  setDestinationInput,
  setDividerCenterY,
  dividerCenterY,
  searchButtonHeight,
  onSearch,
  hasNavigationInputs,
  navigationSummary,
  navigationSteps,

  // Floating controls + feedback
  focusButtonBottom,
  onFocusMyLocation,
  locationError,
  locationErrorBottom,

  // Keyboard
  keyboardInset = 0,
}) {
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

  // 패널이 화면 상단을 넘어가지 않도록 제한
  const maxKeyboardOffset = collapsedTranslateY - expandedTranslateY
  const keyboardOffset = keyboardInset > 0 ? -Math.min(keyboardInset, maxKeyboardOffset) : 0

  // 내비게이션 힌트 표시 여부
  const showNavigationHint = isNavigationTab && !hasNavigationInputs

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
        <UrlTile urlTemplate={tileUrlTemplate} maximumZ={22} shouldReplaceMapContent />
        {currentLocation ? (
          <Marker coordinate={currentLocation} tracksViewChanges={false}>
            <View style={styles.locationDotOuter}>
              <View style={styles.locationDotInner} />
            </View>
          </Marker>
        ) : null}
      </MapView>

      {/* Top overlay: home search + map type switch */}
      <View style={[styles.topPanel, { top: topPanelTop }]}>
        {isHomeTab ? (
          <View style={[styles.inputCard, styles.homeInputCard]}>
            <TextInput
              style={styles.homeInput}
              value={placeQuery}
              onChangeText={setPlaceQuery}
              placeholder={labels.placeSearchPlaceholder}
              placeholderTextColor="#475569"
              returnKeyType="search"
              onSubmitEditing={onPlaceSearch}
            />
            <Pressable
              style={styles.homeSearchButton}
              onPress={onPlaceSearch}
              accessibilityRole="button"
              accessibilityLabel={labels.search}
            >
              <MaterialIcons name="search" size={20} color="#f8fafc" />
            </Pressable>
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
              {labels.road}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.mapTypeButton, mapType === 'satellite' && styles.mapTypeButtonActive]}
            onPress={() => setMapType('satellite')}
          >
            <Text
              style={[styles.mapTypeButtonText, mapType === 'satellite' && styles.mapTypeButtonTextActive]}
            >
              {labels.satellite}
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
            <>
              <View style={styles.transitButtonRow}>
                <Pressable
                  style={[styles.mapTypeButton, transitType === 'bus' && styles.mapTypeButtonActive]}
                  onPress={() => setTransitType('bus')}
                >
                  <Text
                    style={[styles.mapTypeButtonText, transitType === 'bus' && styles.mapTypeButtonTextActive]}
                  >
                    {labels.bus}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.mapTypeButton, transitType === 'subway' && styles.mapTypeButtonActive]}
                  onPress={() => setTransitType('subway')}
                >
                  <Text
                    style={[styles.mapTypeButtonText, transitType === 'subway' && styles.mapTypeButtonTextActive]}
                  >
                    {labels.subway}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.transitCardsContainer}>
                {transitRoutes
                  .filter((route) => route.type === transitType)
                  .map((route) => (
                    <View key={route.id} style={styles.transitCard}>
                      <View style={styles.transitCardHeader}>
                        <Text style={styles.routeName}>{route.routeName}</Text>
                        <Text style={styles.arrivalTime}>{route.arrivalTime}</Text>
                      </View>
                      <View style={styles.transitCardBody}>
                        <View style={styles.transitInfo}>
                          <Text style={styles.transitLabel}>도착 시간</Text>
                          <Text style={styles.transitValue}>{route.destinationArrival}</Text>
                        </View>
                        <View style={styles.transitInfo}>
                          <Text style={styles.transitLabel}>정거장 수</Text>
                          <Text style={styles.transitValue}>{route.stops}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
              </View>
            </>
          ) : null}

          {/* Navigation tab content */}
          {isNavigationTab ? (
            <View style={styles.navigationPanel}>
              <View style={styles.navigationInputCard}>
                <TextInput
                  ref={originRef}
                  style={styles.input}
                  value={originInput}
                  onChangeText={setOriginInput}
                  placeholder={labels.originPlaceholder}
                  placeholderTextColor="#94a3b8"
                />
                <View
                  style={styles.inputDivider}
                  onLayout={(event) => {
                    const { y, height } = event.nativeEvent.layout
                    setDividerCenterY(y + height / 2)
                  }}
                />
                <TextInput
                  style={styles.input}
                  value={destinationInput}
                  onChangeText={setDestinationInput}
                  placeholder={labels.destinationPlaceholder}
                  placeholderTextColor="#94a3b8"
                />
                <Pressable
                  style={[
                    styles.searchButton,
                    dividerCenterY == null
                      ? styles.searchButtonFallback
                      : { top: dividerCenterY - searchButtonHeight / 2 },
                  ]}
                  onPress={onSearch}
                  accessibilityRole="button"
                  accessibilityLabel={labels.search}
                >
                  <MaterialIcons name="search" size={18} color="#f8fafc" />
                  <Text style={styles.searchButtonText}>{labels.search}</Text>
                </Pressable>
              </View>

              {hasNavigationInputs ? (
                <>
                  <View style={styles.navigationHeaderRow}>
                    <Text style={styles.navigationPanelTitle}>{labels.navigationPanelTitle}</Text>
                    <View style={styles.navigationDistancePill}>
                      <Text style={styles.navigationDistancePillText}>
                        {labels.distance} {navigationSummary.distance}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.navigationMetaRow}>
                    <View style={styles.navigationMetaItem}>
                      <Text style={styles.navigationMetaLabel}>{labels.eta}</Text>
                      <Text style={styles.navigationMetaValue}>{navigationSummary.eta}</Text>
                    </View>
                    <View style={styles.navigationMetaDivider} />
                    <View style={styles.navigationMetaItem}>
                      <Text style={styles.navigationMetaLabel}>{labels.duration}</Text>
                      <Text style={styles.navigationMetaValue}>{navigationSummary.duration}</Text>
                    </View>
                  </View>

                  <View style={styles.navigationRouteCard}>
                    <Text style={styles.navigationRouteFrom}>{navigationSummary.from}</Text>
                    <View style={styles.navigationRouteLine} />
                    <Text style={styles.navigationRouteTo}>{navigationSummary.to}</Text>
                  </View>

                  <View style={styles.navigationSteps}>
                    {navigationSteps.map((step) => (
                      <View key={step.id} style={styles.navigationStepRow}>
                        <MaterialIcons name={step.icon} size={17} color="#334155" />
                        <Text style={styles.navigationStepText}>{step.text}</Text>
                      </View>
                    ))}
                  </View>

                  <Pressable style={styles.navigationStartButton}>
                    <MaterialIcons name="navigation" size={18} color="#f8fafc" />
                    <Text style={styles.navigationStartButtonText}>{labels.startGuidance}</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

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
              <Text style={styles.navigationHintText}>{labels.routeHint}</Text>
            </View>
          </View>
        ) : null}
      </Animated.View>

      {/* Floating "focus my location" button */}
      <Pressable
        style={[styles.focusButton, { bottom: focusButtonBottom }]}
        onPress={onFocusMyLocation}
        accessibilityRole="button"
        accessibilityLabel={labels.focusMyLocation}
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


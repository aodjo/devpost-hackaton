import { Animated, Platform, Pressable, Text, TextInput, View } from 'react-native'
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
}) {
  return (
    <>
      {/* Base map + live location marker */}
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        initialRegion={initialRegion}
        onPress={isBottomPanelTab ? onBackgroundPress : undefined}
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
      <View style={[styles.topPanel, { top: insets.top + 12 }]}>
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

        <Animated.View style={[styles.mapTypeRow, mapTypeRowAnimatedStyle]}>
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
              {
                translateY: collapseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 50],
                }),
              },
            ],
          },
        ]}
        pointerEvents={isBottomPanelTab ? 'auto' : 'none'}
      >
        <View style={[styles.collapsibleContent, { paddingBottom: panelBottomClearance }]}>
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
                          <Text style={styles.transitLabel}>목적지 도착:</Text>
                          <Text style={styles.transitValue}>{route.destinationArrival}</Text>
                        </View>
                        <View style={styles.transitInfo}>
                          <Text style={styles.transitLabel}>경유:</Text>
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
              ) : (
                <View style={styles.navigationHintCard}>
                  <View style={styles.navigationHintContent}>
                    <FontAwesome5 name="route" size={44} color="#334155" />
                    <Text style={styles.navigationHintText}>{labels.routeHint}</Text>
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </View>
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

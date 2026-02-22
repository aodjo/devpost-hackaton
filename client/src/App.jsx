import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import * as Location from 'expo-location'
import { MaterialIcons } from '@expo/vector-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View, Alert, Animated } from 'react-native'
import MapView, { Marker, UrlTile } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'

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

const LABELS = {
  home: '\uD648',
  navigation: '\uB0B4\uBE44\uAC8C\uC774\uC158',
  transit: '\uB300\uC911\uAD50\uD1B5',
  profile: '\uB0B4 \uC815\uBCF4',
  road: '\uAC04\uB7B5',
  satellite: '\uC704\uC131',
  bus: '\uBC84\uC2A4',
  subway: '\uC9C0\uD558\ucca0',
  originPlaceholder: '\uCD9C\uBC1C\uC9C0 \uC785\uB825',
  destinationPlaceholder: '\uBAA9\uC801\uC9C0 \uC785\uB825',
  search: '\uAC80\uC0C9',
  permissionRequired: '\uC704\uCE58 \uAD8C\uD55C \uD544\uC694',
  locationLoadFailed: '\uC704\uCE58 \uBD88\uB7EC\uC624\uAE30 \uC2E4\uD328',
  focusMyLocation: '\uB0B4 \uC704\uCE58\uB85C \uD3EC\uCEE4\uC2A4',
}

const NAV_ITEMS = [LABELS.home, LABELS.navigation, LABELS.transit, LABELS.profile]

const INITIAL_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
}
const SEARCH_BUTTON_HEIGHT = 34
const NAVBAR_RADIUS = 14
const NAVBAR_VERTICAL_PADDING = 8

function App() {
  const mapRef = useRef(null)
  const originRef = useRef(null)
  const [collapseAnim] = useState(() => new Animated.Value(0))
  const [mapType, setMapType] = useState('roadmap')
  const [activeTab, setActiveTab] = useState(LABELS.home)
  const [transitType, setTransitType] = useState('bus')
  const [originInput, setOriginInput] = useState('')
  const [destinationInput, setDestinationInput] = useState('')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [dividerCenterY, setDividerCenterY] = useState(null)

  const transitRoutes = [
    {
      id: '1',
      type: 'bus',
      routeName: '142번',
      arrivalTime: '3분',
      destinationArrival: '18분',
      stops: '5정류장',
    },
    {
      id: '2',
      type: 'bus',
      routeName: '405번',
      arrivalTime: '8분',
      destinationArrival: '22분',
      stops: '7정류장',
    },
    {
      id: '3',
      type: 'bus',
      routeName: '720번',
      arrivalTime: '12분',
      destinationArrival: '25분',
      stops: '6정류장',
    },
    {
      id: '4',
      type: 'subway',
      routeName: '2호선',
      arrivalTime: '2분',
      destinationArrival: '15분',
      stops: '3역',
    },
    {
      id: '5',
      type: 'subway',
      routeName: '6호선',
      arrivalTime: '7분',
      destinationArrival: '20분',
      stops: '4역',
    },
  ]

  const tileUrlTemplate = useMemo(() => {
    const normalizedBase = `${TILE_PROXY_BASE_URL}`.replace(/\/+$/, '')
    return `${normalizedBase}/maps/tiles/{z}/{x}/{y}.png?${TILE_QUERY}&mapType=${encodeURIComponent(mapType)}`
  }, [mapType])

  useEffect(() => {
    let watchSubscription
    let mounted = true

    const startLocationTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        if (mounted) {
          setLocationError(LABELS.permissionRequired)
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
    }

    startLocationTracking().catch(() => {
      if (mounted) {
        setLocationError(LABELS.locationLoadFailed)
      }
    })

    return () => {
      mounted = false
      if (watchSubscription) {
        watchSubscription.remove()
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

  useEffect(() => {
    if (activeTab === LABELS.navigation) {
      originRef.current?.focus()
    } else if (activeTab === LABELS.home) {
      setMapType('roadmap')
    } else if (activeTab === LABELS.profile) {
      Alert.alert('Profile', 'Profile tab selected')
    }
  }, [activeTab])

  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: activeTab === LABELS.transit ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start()
  }, [activeTab, collapseAnim])

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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          initialRegion={INITIAL_REGION}
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

        <View style={styles.topPanel}>
          <View style={styles.inputCard}>
            <TextInput
              ref={originRef}
              style={styles.input}
              value={originInput}
              onChangeText={setOriginInput}
              placeholder={LABELS.originPlaceholder}
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
              placeholder={LABELS.destinationPlaceholder}
              placeholderTextColor="#94a3b8"
            />
            <Pressable
              style={[
                styles.searchButton,
                dividerCenterY == null
                  ? styles.searchButtonFallback
                  : { top: dividerCenterY - SEARCH_BUTTON_HEIGHT / 2 },
              ]}
              onPress={handleSearch}
              accessibilityRole="button"
              accessibilityLabel={LABELS.search}
            >
              <MaterialIcons name="search" size={18} color="#f8fafc" />
              <Text style={styles.searchButtonText}>{LABELS.search}</Text>
            </Pressable>
          </View>

          <Animated.View style={[styles.mapTypeRow, mapTypeRowAnimatedStyle]}>
            <Pressable
              style={[
                styles.mapTypeButton,
                mapType === 'roadmap' && styles.mapTypeButtonActive,
              ]}
              onPress={() => setMapType('roadmap')}
            >
              <Text
                style={[
                  styles.mapTypeButtonText,
                  mapType === 'roadmap' && styles.mapTypeButtonTextActive,
                ]}
              >
                {LABELS.road}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.mapTypeButton,
                mapType === 'satellite' && styles.mapTypeButtonActive,
              ]}
              onPress={() => setMapType('satellite')}
            >
              <Text
                style={[
                  styles.mapTypeButtonText,
                  mapType === 'satellite' && styles.mapTypeButtonTextActive,
                ]}
              >
                {LABELS.satellite}
              </Text>
            </Pressable>
          </Animated.View>
        </View>

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
          pointerEvents={activeTab === LABELS.transit ? 'auto' : 'none'}
        >
          <View style={styles.collapsibleContent}>
            <View style={styles.transitButtonRow}>
              <Pressable
                style={[
                  styles.mapTypeButton,
                  transitType === 'bus' && styles.mapTypeButtonActive,
                ]}
                onPress={() => setTransitType('bus')}
              >
                <Text
                  style={[
                    styles.mapTypeButtonText,
                    transitType === 'bus' && styles.mapTypeButtonTextActive,
                  ]}
                >
                  {LABELS.bus}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.mapTypeButton,
                  transitType === 'subway' && styles.mapTypeButtonActive,
                ]}
                onPress={() => setTransitType('subway')}
              >
                <Text
                  style={[
                    styles.mapTypeButtonText,
                    transitType === 'subway' && styles.mapTypeButtonTextActive,
                  ]}
                >
                  {LABELS.subway}
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
          </View>
        </Animated.View>

        <Pressable
          style={styles.focusButton}
          onPress={focusMyLocation}
          accessibilityRole="button"
          accessibilityLabel={LABELS.focusMyLocation}
        >
          <MaterialIcons name="gps-fixed" size={22} color="#f8fafc" />
        </Pressable>

        {locationError ? <Text style={styles.locationError}>{locationError}</Text> : null}

        <View style={styles.bottomNav}>
          {NAV_ITEMS.map((item) => (
            <Pressable
              key={item}
              style={styles.navItem}
              onPress={() => setActiveTab(item)}
            >
              <Text style={[styles.navText, activeTab === item && styles.navTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <StatusBar style="auto" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#e2e8f0',
  },
  mapWrapper: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topPanel: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 10,
    elevation: 10,
  },
  inputCard: {
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  input: {
    fontSize: 15,
    color: '#0f172a',
    paddingHorizontal: 6,
    paddingVertical: 8,
    paddingRight: 92,
  },
  inputDivider: {
    height: 1,
    backgroundColor: '#cbd5e1',
    marginRight: 84,
  },
  searchButton: {
    position: 'absolute',
    right: 10,
    minWidth: 68,
    height: SEARCH_BUTTON_HEIGHT,
    borderRadius: 17,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: '#020617',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  searchButtonFallback: {
    top: 32,
  },
  searchButtonText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  mapTypeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  mapTypeButton: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  mapTypeButtonActive: {
    backgroundColor: '#0f172a',
  },
  mapTypeButtonText: {
    fontWeight: '600',
    color: '#0f172a',
  },
  mapTypeButtonTextActive: {
    color: '#f8fafc',
  },
  focusButton: {
    position: 'absolute',
    right: 12,
    bottom: 92,
    backgroundColor: '#0f172a',
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationError: {
    position: 'absolute',
    left: 12,
    bottom: 74,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    color: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: NAVBAR_VERTICAL_PADDING,
    borderRadius: NAVBAR_RADIUS,
    fontSize: 12,
    overflow: 'hidden',
  },
  locationDotOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.7)',
  },
  locationDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  bottomNav: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: NAVBAR_RADIUS,
    paddingVertical: NAVBAR_VERTICAL_PADDING,
    paddingHorizontal: 6,
    zIndex: 20,
    elevation: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  navText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  navTextActive: {
    color: '#0f172a',
  },
  collapsiblePanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 0,
    minHeight: 550,
    zIndex: 15,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  collapsibleContent: {
    padding: 12,
  },
  transitButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    marginTop: 0,
  },
  collapsibleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  collapsibleText: {
    fontSize: 13,
    color: '#475569',
  },
  transitCardsContainer: {
    marginTop: 16,
    gap: 12,
  },
  transitCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  transitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  arrivalTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  transitCardBody: {
    gap: 6,
  },
  transitInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transitLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  transitValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
})

export default App

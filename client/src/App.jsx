import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import * as Location from 'expo-location'
import { MaterialIcons } from '@expo/vector-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
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
  const [mapType, setMapType] = useState('roadmap')
  const [activeTab, setActiveTab] = useState(LABELS.home)
  const [originInput, setOriginInput] = useState('')
  const [destinationInput, setDestinationInput] = useState('')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [dividerCenterY, setDividerCenterY] = useState(null)

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

          <View style={styles.mapTypeRow}>
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
          </View>
        </View>

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
})

export default App

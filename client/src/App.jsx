import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import { Platform, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, UrlTile } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'

const TILE_PROXY_BASE_URL =
  Constants.expoConfig?.extra?.tileProxyBaseUrl ?? 'http://10.0.2.2:8000'
const DEVICE_LOCALE = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US'
const NORMALIZED_LOCALE = DEVICE_LOCALE.replace('_', '-')
const LOCALE_PARTS = NORMALIZED_LOCALE.split('-')
const TILE_LANGUAGE = NORMALIZED_LOCALE
const TILE_REGION =
  LOCALE_PARTS.length > 1 && /^[A-Za-z]{2}$/.test(LOCALE_PARTS[LOCALE_PARTS.length - 1])
    ? LOCALE_PARTS[LOCALE_PARTS.length - 1].toUpperCase()
    : undefined
const TILE_QUERY =
  TILE_REGION
    ? `lang=${encodeURIComponent(TILE_LANGUAGE)}&region=${encodeURIComponent(TILE_REGION)}`
    : `lang=${encodeURIComponent(TILE_LANGUAGE)}`
const TILE_URL_TEMPLATE =
  `${TILE_PROXY_BASE_URL}`.replace(/\/+$/, '') + `/maps/tiles/{z}/{x}/{y}.png?${TILE_QUERY}`

function App() {
  const seoulCityHall = { latitude: 37.5665, longitude: 126.978 }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Google Map Tiles (Proxy)</Text>
      <View style={styles.mapWrapper}>
        <MapView
          style={StyleSheet.absoluteFill}
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          initialRegion={{
            latitude: seoulCityHall.latitude,
            longitude: seoulCityHall.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <UrlTile
            urlTemplate={TILE_URL_TEMPLATE}
            maximumZ={22}
            shouldReplaceMapContent
          />
          <Marker coordinate={seoulCityHall} title="Seoul City Hall" />
        </MapView>
      </View>
      <Text style={styles.attribution}>Map data and tiles Google</Text>
      <StatusBar style="auto" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f7fb',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827',
  },
  mapWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  attribution: {
    marginTop: 10,
    fontSize: 12,
    color: '#4b5563',
    textAlign: 'center',
  },
})

export default App

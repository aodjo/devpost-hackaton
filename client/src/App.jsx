import { StatusBar } from 'expo-status-bar'
import { Platform, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, UrlTile } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'

function App() {
  const seoulCityHall = { latitude: 37.5665, longitude: 126.978 }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>OpenStreetMap on React Native</Text>
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
            urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
          />
          <Marker coordinate={seoulCityHall} title="Seoul City Hall" />
        </MapView>
      </View>
      <Text style={styles.attribution}>Map data OpenStreetMap contributors</Text>
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

import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

function App() {
  const seoulCityHall = [37.5665, 126.978]

  return (
    <main className="app">
      <h1>Hello, world!</h1>
      <MapContainer center={seoulCityHall} zoom={13} scrollWheelZoom className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker center={seoulCityHall} radius={12}>
          <Popup>Seoul City Hall</Popup>
        </CircleMarker>
      </MapContainer>
    </main>
  )
}

export default App

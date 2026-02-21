# React Native Client (Expo)

This client was refactored from a web-only Vite app to an Expo-based React Native app.
It renders OpenStreetMap tiles using `react-native-maps` + `UrlTile`.

## Run

```bash
npm install
npm run start
```

Useful targets:

- `npm run android` (Expo Go + cache clear)
- `npm run ios` (Expo Go + cache clear)
- `npm run web`
- `npm run start:dev-client` (only if you use a custom development build)
- `npm run lint`
- `npm run config`

## Map

Tile source:

`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

Remember OpenStreetMap attribution when displaying map data.

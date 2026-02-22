import { registerRootComponent } from 'expo'
import { useFonts } from 'expo-font'
import { Text, TextInput } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import App from './src/App'
import { FontSizeProvider } from './src/context/FontSizeContext'
import PretendardRegular from './assets/fonts/Pretendard-Regular.ttf'

const GLOBAL_FONT_STYLE = { fontFamily: 'Pretendard-Regular' }

const applyGlobalFont = (Component) => {
  if (!Component.defaultProps) {
    Component.defaultProps = {}
  }

  const prevStyle = Component.defaultProps.style
  if (Array.isArray(prevStyle)) {
    Component.defaultProps.style = [...prevStyle, GLOBAL_FONT_STYLE]
    return
  }

  Component.defaultProps.style = prevStyle ? [prevStyle, GLOBAL_FONT_STYLE] : GLOBAL_FONT_STYLE
}

applyGlobalFont(Text)
applyGlobalFont(TextInput)

function Root() {
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': PretendardRegular,
  })

  if (!fontsLoaded) {
    return null
  }

  return (
    <SafeAreaProvider>
      <FontSizeProvider>
        <App />
      </FontSizeProvider>
    </SafeAreaProvider>
  )
}

registerRootComponent(Root)

import { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const FONT_SIZE_KEY = 'appFontSize'

const FONT_SCALES = {
  small: 0.85,
  medium: 1,
  large: 1.2,
}

const FontSizeContext = createContext({
  fontSize: 'medium',
  fontScale: 1,
  setFontSize: () => {},
})

export function FontSizeProvider({ children }) {
  const [fontSize, setFontSizeState] = useState('medium')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const loadFontSize = async () => {
      try {
        const stored = await AsyncStorage.getItem(FONT_SIZE_KEY)
        if (stored && ['small', 'medium', 'large'].includes(stored)) {
          setFontSizeState(stored)
        }
      } catch {
        // Ignore errors
      } finally {
        setIsLoaded(true)
      }
    }
    loadFontSize()
  }, [])

  const setFontSize = async (size) => {
    if (!['small', 'medium', 'large'].includes(size)) return
    setFontSizeState(size)
    try {
      await AsyncStorage.setItem(FONT_SIZE_KEY, size)
    } catch {
      // Ignore errors
    }
  }

  const fontScale = FONT_SCALES[fontSize] || 1

  if (!isLoaded) {
    return null
  }

  return (
    <FontSizeContext.Provider value={{ fontSize, fontScale, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  )
}

export function useFontSize() {
  return useContext(FontSizeContext)
}

// 스케일된 폰트 크기 계산 헬퍼
export function scaledFontSize(baseSize, scale) {
  return Math.round(baseSize * scale)
}

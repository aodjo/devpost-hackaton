import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'
import AsyncStorage from '@react-native-async-storage/async-storage'

import ko from './locales/ko.json'
import en from './locales/en.json'

const LANGUAGE_STORAGE_KEY = '@app_language'

const resources = {
  ko: { translation: ko },
  en: { translation: en },
}

const getDeviceLanguage = () => {
  const locale = Localization.getLocales()[0]?.languageCode ?? 'ko'
  return locale === 'ko' ? 'ko' : 'en'
}

// 동기 초기화 (기본 언어로 시작)
i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

// 저장된 언어 로드 (비동기)
export const loadStoredLanguage = async () => {
  try {
    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (storedLanguage && storedLanguage !== i18n.language) {
      await i18n.changeLanguage(storedLanguage)
    }
  } catch {
    // Ignore
  }
}

export const changeLanguage = async (language) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    await i18n.changeLanguage(language)
  } catch {
    // Ignore language change failures
  }
}

export const getCurrentLanguage = () => i18n.language

export default i18n

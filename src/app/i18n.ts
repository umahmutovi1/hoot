import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import bs from '@/locales/bs.json'
import en from '@/locales/en.json'
import { DEFAULT_LOCALE, getStoredLocale } from '@/lib/locale'

export const resources = {
  bs: { translation: bs },
  en: { translation: en },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  returnNull: false,
})

document.documentElement.lang = i18n.language
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n

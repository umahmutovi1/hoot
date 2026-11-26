import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import bs from '@/locales/bs.json'
import en from '@/locales/en.json'
import { addressContext, type Gender } from '@/lib/address'
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

// Address form (src/lib/address.ts): every `t()` gets the user's form as its i18next context, so
// a string with a `_male` variant picks it and every other string is untouched. Screens do not
// pass it themselves; a context given by a caller wins.
let gender: Gender | null = null
const translate = i18n.t.bind(i18n) as unknown as (...args: unknown[]) => unknown
const withAddress = (key: unknown, ...rest: unknown[]) => {
  const context = addressContext(gender)
  const [options] = rest
  // `t(key, 'default text')` has no options object to carry a context.
  if (!context || (rest.length > 0 && (typeof options !== 'object' || options === null)))
    return translate(key, ...rest)
  return translate(key, { context, ...(options as object) })
}
i18n.t = withAddress as unknown as typeof i18n.t

/** Switches the address form and re-renders what is on screen. */
export function setAddressGender(next: Gender | null) {
  if (next === gender) return
  gender = next
  i18n.emit('languageChanged', i18n.language)
}

document.documentElement.lang = i18n.language
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n

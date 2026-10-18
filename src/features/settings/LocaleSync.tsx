import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { isLocale, storeLocale, takePendingLocale } from '@/lib/locale'
import { useProfile, useUpdateLocale } from './profile'

/**
 * Keeps i18n in line with profiles.locale after sign-in. A locale picked on the login
 * screen wins once and is written to the profile; otherwise the profile wins.
 */
export function LocaleSync() {
  const { i18n } = useTranslation()
  const { data: profile } = useProfile()
  const updateLocale = useUpdateLocale()
  const synced = useRef(false)

  useEffect(() => {
    if (!profile || synced.current) return
    synced.current = true

    const pending = takePendingLocale()
    if (pending && pending !== profile.locale) {
      updateLocale.mutate(pending)
      return
    }
    if (isLocale(profile.locale) && profile.locale !== i18n.language) {
      void i18n.changeLanguage(profile.locale)
      storeLocale(profile.locale)
    }
  }, [profile, i18n, updateLocale])

  return null
}

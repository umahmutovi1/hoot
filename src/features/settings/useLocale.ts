import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { isLocale, storeLocale, DEFAULT_LOCALE, type Locale } from '@/lib/locale'
import { useAuth } from '@/features/auth/auth-context'
import { useUpdateLocale } from './profile'

/** Current UI locale and a setter that persists it locally and, when signed in, to the profile. */
export function useLocale() {
  const { i18n } = useTranslation()
  const { session } = useAuth()
  const updateLocale = useUpdateLocale()
  const locale: Locale = isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE

  const setLocale = useCallback(
    (next: Locale) => {
      void i18n.changeLanguage(next)
      storeLocale(next, { pending: !session })
      if (session) updateLocale.mutate(next)
    },
    [i18n, session, updateLocale],
  )

  return { locale, setLocale }
}

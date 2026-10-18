import { bs, enUS, type Locale as DateFnsLocale } from 'date-fns/locale'

export const LOCALES = ['bs', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'bs'

const STORAGE_KEY = 'hoot.locale'
// Set when the locale is picked before sign-in, so it wins over the profile once.
const PENDING_KEY = 'hoot.locale.pending'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export const dateFnsLocales: Record<Locale, DateFnsLocale> = { bs, en: enUS }

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode); the locale then lasts for the session only.
  }
}

export function getStoredLocale(): Locale {
  const value = read(STORAGE_KEY)
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export function storeLocale(locale: Locale, { pending = false } = {}) {
  write(STORAGE_KEY, locale)
  if (pending) write(PENDING_KEY, '1')
}

export function takePendingLocale(): Locale | null {
  if (read(PENDING_KEY) !== '1') return null
  write(PENDING_KEY, null)
  return getStoredLocale()
}

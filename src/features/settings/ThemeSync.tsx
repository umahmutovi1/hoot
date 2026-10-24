import { useEffect } from 'react'
import { useProfile } from './profile'
import { applyTheme, isTheme } from './theme'

/** Keeps <html data-theme> in step with `profiles.theme` (synced across devices). */
export function ThemeSync() {
  const { data: profile } = useProfile()
  const theme = profile?.theme
  useEffect(() => {
    if (isTheme(theme)) applyTheme(theme)
  }, [theme])
  return null
}

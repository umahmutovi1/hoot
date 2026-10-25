// Colour themes (PRD "Teme boja", Stage 10b). The tokens live in index.css per `data-theme`; this
// only names the themes and applies one to <html>.

export const THEMES = ['lavender', 'graphite', 'sand', 'sage', 'ocean'] as const
export type Theme = (typeof THEMES)[number]

const CACHE_KEY = 'hoot.theme'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

/** Sets the theme on <html> and Safari's bar colour (`theme-color`), and remembers it locally. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'lavender') delete root.dataset.theme
  else root.dataset.theme = theme
  const edge = getComputedStyle(root).getPropertyValue('--hoot-edge').trim()
  if (edge) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', edge)
  try {
    localStorage.setItem(CACHE_KEY, theme)
  } catch {
    // The profile is the source of truth; the cache only avoids a flash on start.
  }
}

/** The theme of the last session, applied before the profile loads (no lavender flash). */
export function applyCachedTheme() {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (isTheme(cached)) applyTheme(cached)
  } catch {
    // Default lavender.
  }
}

import type { NavigateFunction } from 'react-router-dom'

/**
 * Back inside the app. React Router numbers its own history entries (`history.state.idx`);
 * `window.history.length` also counts pages outside the app (a PDF tab, the page the PWA was
 * opened from), where `navigate(-1)` leaves the app or does nothing in a standalone PWA.
 */
export function goBack(navigate: NavigateFunction, fallback: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (idx > 0) navigate(-1)
  else navigate(fallback, { replace: true })
}

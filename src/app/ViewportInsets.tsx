import { useEffect } from 'react'

/** A keyboard is open when it covers more than this. */
const KEYBOARD_MIN_PX = 120

/**
 * Keeps two things on <html> in sync with what is actually visible (Safari):
 * - `--vv-bottom`: how far the bottom of the box `position: fixed` uses lies below the bottom of
 *   the visible viewport. iOS 26 Safari places fixed elements against a viewport that reaches
 *   under its expanded toolbar, so `bottom: 16px` alone ends up half hidden; the keyboard does
 *   the same. Fixed and sticky bottom bars add this offset.
 * - `data-keyboard`: set while the on-screen keyboard is open, so the tab bar can step aside.
 * Elsewhere (desktop, installed app) the offset is 0 and nothing changes.
 */
export function ViewportInsets() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:fixed;top:0;bottom:0;left:0;width:0;visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)
    const root = document.documentElement
    let frame = 0

    const update = () => {
      frame = 0
      const fixedBottom = probe.getBoundingClientRect().bottom
      const visibleBottom = vv.height + vv.offsetTop
      // getBoundingClientRect is relative to the layout viewport, like vv.offsetTop.
      const gap = Math.max(0, Math.round(fixedBottom - visibleBottom))
      root.style.setProperty('--vv-bottom', `${gap}px`)
      if (gap > KEYBOARD_MIN_PX) root.dataset.keyboard = ''
      else delete root.dataset.keyboard
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      probe.remove()
      root.style.removeProperty('--vv-bottom')
      delete root.dataset.keyboard
    }
  }, [])
  return null
}

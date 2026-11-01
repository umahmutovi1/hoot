import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCelebration } from './celebrate-store'

const SHOW_MS = 3200

/** A short glass card at the top with the ring drawing to full; tap to close. No mascot. */
export function Celebration() {
  const { t } = useTranslation()
  const current = useCelebration((s) => s.current)
  const hide = useCelebration((s) => s.hide)
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(hide, SHOW_MS)
    return () => clearTimeout(timer)
  }, [current, hide])
  if (!current) return null
  return (
    <button
      key={current.id}
      type="button"
      role="status"
      onClick={hide}
      className="glass-strong animate-in fade-in slide-in-from-top-3 fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-50 mx-auto flex w-[calc(100%-36px)] max-w-[394px] items-center gap-3.5 rounded-card-lg p-3.5 pr-5 text-left motion-reduce:animate-none"
    >
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
        <circle cx="24" cy="24" r="20" fill="none" strokeWidth="6" className="stroke-track" />
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={1}
          transform="rotate(-90 24 24)"
          className="animate-ring-draw stroke-brand-accent"
        />
        <path
          d="M16.5 24.5l5 5 10-11"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-check-pop stroke-brand"
        />
      </svg>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-semibold">{t(`celebrate.${current.kind}.title`)}</span>
        <span className="text-sm text-ink-secondary">
          {t(`celebrate.${current.kind}.body`, { name: current.name ?? '' })}
        </span>
      </span>
    </button>
  )
}

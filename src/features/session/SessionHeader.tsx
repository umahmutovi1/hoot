import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { goBack } from '@/app/navigation'
import { ChevronLeftIcon } from '@/components/icons'

/** Sticky header of the full-screen session screens, clear of the status bar. */
export function SessionHeader({
  title,
  subtitle,
  fallback,
  action,
}: {
  title: string
  subtitle?: string | null
  fallback: string
  action?: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-10 -mx-5 -mt-6 flex items-center justify-between gap-2 glass-bar px-5 pt-[calc(24px+env(safe-area-inset-top))] pb-2 ">
      <button
        type="button"
        onClick={() => goBack(navigate, fallback)}
        aria-label={t('app.back')}
        className="flex size-11 shrink-0 items-center justify-center rounded-full glass"
      >
        <ChevronLeftIcon size={20} />
      </button>
      <div className="flex min-w-0 flex-col items-center gap-0.5">
        <h1 className="truncate text-base font-semibold">{title}</h1>
        {subtitle && (
          <span className="truncate text-xs text-ink-muted first-letter:uppercase">{subtitle}</span>
        )}
      </div>
      {action ?? <span className="w-11 shrink-0" />}
    </div>
  )
}

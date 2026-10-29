import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOwlStore } from './store'

/**
 * A document read in the background (PRD "AI uvoz"): while it is read the user can be anywhere in
 * the app; this card says it is still going and, when it ends, opens the review. The chat shows
 * the same in its messages, so the card is not shown there.
 */
export function ImportJobBanner({ top = false }: { top?: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const job = useOwlStore((s) => s.job)
  const sheetOpen = useOwlStore((s) => s.sheet.open)
  const setJob = useOwlStore((s) => s.setJob)
  if (!job || pathname === '/chat' || pathname.startsWith('/chat/import') || sheetOpen) return null

  return (
    <div
      role="status"
      className={cn(
        'fixed inset-x-0 z-40 mx-auto w-[calc(100%-32px)] max-w-[398px]',
        // Onboarding and the session keep their main button at the bottom.
        top
          ? 'top-[calc(12px+env(safe-area-inset-top))]'
          : 'bottom-[calc(16px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))]',
      )}
    >
      <div className="flex flex-col gap-2.5 rounded-card glass-strong p-4 shadow-lg">
        {job.status === 'running' ? (
          <>
            <span className="truncate animate-pulse text-[15px] font-semibold">
              {t('owl.job.running', { title: job.title })}
            </span>
            {job.long && (
              <span className="text-[13px] leading-[1.4] text-ink-muted">
                {t('owl.job.runningLong')}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-[15px] font-semibold">
              {t(job.status === 'done' ? 'owl.job.doneTitle' : 'owl.job.errorTitle')}
            </span>
            <span className="text-[13px] leading-[1.4] text-ink-secondary">
              {job.status === 'done'
                ? job.found > 0
                  ? t('owl.job.doneBody', { count: job.found, title: job.title })
                  : t('owl.job.doneNothing', { title: job.title })
                : t(`owl.error.${job.code}`)}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="pill-sm"
                className="flex-1"
                onClick={() => {
                  setJob(null)
                  navigate(
                    job.status === 'done' && job.proposalId
                      ? `/chat/import/${job.proposalId}`
                      : '/chat',
                  )
                }}
              >
                {t(job.status === 'done' && job.proposalId ? 'owl.job.review' : 'owl.job.open')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="pill-sm"
                className="flex-1 bg-brand-soft text-brand"
                onClick={() => setJob(null)}
              >
                {t('owl.job.dismiss')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

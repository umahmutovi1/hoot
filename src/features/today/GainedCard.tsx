import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClockIcon } from '@/components/icons'
import { usePlanStore } from '@/features/plan/store'
import { formatDuration } from '@/features/sources/format'
import { useSubjects } from '@/features/subjects/api'
import { BlockSheet } from '@/features/plan/BlockSheet'
import { pickTitle } from './pick'
import { useGainedCard } from './useGainedCard'
import type { PlanToday } from './usePlanToday'

/**
 * "Imaš X min više danas" (PRD "Današnji dan se preslaže", Stage 10b): today's free time grew
 * and there is urgent work, so the plan offers it instead of filling it silently. "Dodaj" opens
 * the "Imam još vremena" sheet on the gained time.
 */
export function GainedCard({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const gained = useGainedCard(plan)
  const setExtraToday = usePlanStore((s) => s.setExtraToday)
  const { data: subjects = [] } = useSubjects()
  const [open, setOpen] = useState(false)
  if (!gained && !open) return null
  const subject = subjects.find((s) => s.id === gained?.pick.subjectId)?.name ?? ''
  return (
    <>
      {gained && (
        <div className="glass flex flex-col gap-3 rounded-card p-4">
          <div className="flex items-start gap-3">
            <span
              className="icon-tile flex size-[38px] shrink-0 items-center justify-center rounded-[12px]"
              aria-hidden="true"
            >
              <ClockIcon size={18} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">
                {t('today.gained.title', { minutes: formatDuration(t, gained.minutes) })}
              </span>
              <span className="text-[13px] leading-[1.35] text-ink-muted">
                {t('today.gained.sub', {
                  title: pickTitle(t, gained.pick, plan.units, subject.split(' ')[0] ?? ''),
                })}
              </span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn-primary h-10 flex-1 rounded-full text-sm font-semibold"
            >
              {t('today.gained.add')}
            </button>
            <button
              type="button"
              onClick={() => setExtraToday(null)}
              className="h-10 flex-1 rounded-full bg-canvas text-sm font-semibold text-brand"
            >
              {t('today.gained.later')}
            </button>
          </div>
        </div>
      )}
      <BlockSheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setExtraToday(null)
        }}
        block={null}
        date={plan.today}
        today={plan.today}
        initialMinutes={gained?.minutes ?? 60}
      />
    </>
  )
}

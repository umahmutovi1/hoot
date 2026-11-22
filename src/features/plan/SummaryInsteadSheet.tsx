import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { CheckIcon } from '@/components/icons'
import { useToast } from '@/components/toast-store'
import { formatDuration } from '@/features/sources/format'
import { useSubjects } from '@/features/subjects/api'
import { toDisplayDate } from '@/lib/day'
import type { SummaryOffer } from '@/lib/scheduler'
import { cn } from '@/lib/utils'
import { usePlanStore } from './store'
import { useSetSummaryStudy } from './useSummaryOffer'

/**
 * "Ne stižeš sve pročitati" (board "Danas · sažetak umjesto čitanja"): read the unread chapters in
 * full, or study them through summaries at a fraction of the time. The choice is a plan input
 * (`units.use_summary`); "Pročitaj cijelo" on a unit undoes it.
 */
export function SummaryInsteadSheet({
  offer,
  open,
  onOpenChange,
}: {
  offer: SummaryOffer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { data: subjects = [] } = useSubjects()
  const model = usePlanStore((s) => s.model)
  const set = useSetSummaryStudy()
  const toast = useToast((s) => s.show)
  const [choice, setChoice] = useState<'read' | 'summary'>('summary')
  const subject = subjects.find((s) => s.id === offer.subjectId)?.name ?? ''
  const goal = model?.built.state.goals.find((g) => g.id === offer.goalId)
  const days =
    goal && model
      ? differenceInCalendarDays(toDisplayDate(goal.on), toDisplayDate(model.built.today))
      : 0

  const apply = () => {
    onOpenChange(false)
    if (choice === 'read') return
    set.mutate(
      { unitIds: offer.unitIds, use: true },
      {
        onSuccess: () =>
          toast(t('summary.instead.done', { count: offer.unitIds.length }), {
            label: t('common.undo'),
            run: () => set.mutate({ unitIds: offer.unitIds, use: false }),
          }),
      },
    )
  }

  const option = (key: 'read' | 'summary', title: string, sub: string) => {
    const on = choice === key
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => setChoice(key)}
        className={cn(
          'flex min-h-16 items-center gap-3 rounded-[20px] px-4 py-3.5 text-left',
          on
            ? 'bg-subject-lavender-soft text-subject-lavender-ink shadow-[inset_0_0_0_2px_var(--color-brand)]'
            : 'surface text-ink',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex size-[22px] shrink-0 items-center justify-center rounded-full',
            on ? 'bg-brand text-ground' : 'shadow-[inset_0_0_0_2px_var(--color-radio-ring)]',
          )}
        >
          {on && <CheckIcon size={14} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-bold">{title}</span>
          <span className={cn('text-[13px] tabular-nums', !on && 'text-ink-muted')}>{sub}</span>
        </span>
      </button>
    )
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('summary.instead.title')}>
      <span className="-mt-2 self-start rounded-lg bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning-muted">
        {t('summary.instead.tag')}
      </span>
      <p className="text-[15px] leading-[22px] text-ink-secondary">
        {t('summary.instead.body', { subject, count: offer.unitIds.length, days })}
      </p>
      <div
        role="radiogroup"
        aria-label={t('summary.instead.how')}
        className="flex flex-col gap-2.5"
      >
        {option(
          'read',
          t('summary.instead.read'),
          t('summary.instead.readSub', { time: formatDuration(t, offer.readMinutes) }),
        )}
        {option(
          'summary',
          t('summary.instead.use'),
          offer.deficitAfter === 0
            ? t('summary.instead.useFits', { time: formatDuration(t, offer.summaryMinutes) })
            : t('summary.instead.useShort', {
                time: formatDuration(t, offer.summaryMinutes),
                short: formatDuration(t, offer.deficitAfter),
              }),
        )}
      </div>
      <p className="px-1 text-[13px] leading-[1.4] text-ink-muted">{t('summary.instead.hint')}</p>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={apply}
          className="btn-primary h-14 rounded-[16px] text-[17px] font-bold"
        >
          {choice === 'summary' ? t('summary.instead.apply') : t('summary.instead.keep')}
        </button>
        {choice === 'summary' && (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-12 text-[15px] font-bold text-brand-strong"
          >
            {t('summary.instead.keep')}
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

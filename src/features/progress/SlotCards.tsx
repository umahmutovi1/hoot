import { useRecordFeedback } from '@/features/strategist/feedback'
import { weekWindow } from '@/lib/progress/week'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { usePlanUi } from '@/features/plan/ui'
import { addDays } from '@/lib/day'
import { proposeRules, DEFAULT_RHYTHM, PART_RANGES } from '@/lib/schedule/rhythm'
import { formatClock } from '@/lib/schedule'
import { useApplySlot } from './slotActions'
import { useProgress } from './useProgress'

export function SlotCards() {
  const { t } = useTranslation()
  const data = useProgress()
  const apply = useApplySlot()
  const record = useRecordFeedback()
  const { snoozed, snooze } = usePlanUi()
  if (!data) return null
  return data.actions
    .filter(
      (c) =>
        (c.action.kind === 'avoid_slot' || c.action.kind === 'add_slot') &&
        (!snoozed[c.id] || snoozed[c.id]! < data.today),
    )
    .map((c) => {
      const a = c.action
      if (a.kind !== 'avoid_slot' && a.kind !== 'add_slot') return null
      const s = data.signals?.[a.weekend ? 'weekend' : 'weekday'][a.part]
      const range =
        a.kind === 'add_slot'
          ? (proposeRules(data.model.built.state.rhythm ?? DEFAULT_RHYTHM, [a.part]).find(
              (r) => r.weekday >= 5 === a.weekend,
            ) ?? PART_RANGES[a.part])
          : PART_RANGES[a.part]
      return (
        <section key={c.id} className="surface flex flex-col gap-3 rounded-card p-4">
          <h2 className="text-base font-semibold">{t(`progress.slotAction.${a.kind}`)}</h2>
          <p className="text-sm text-ink-secondary">
            {t('progress.slotAction.detail', {
              days: t(a.weekend ? 'progress.slots.weekend' : 'progress.slots.weekday'),
              part: t(`progress.parts.${a.part}`),
              start: formatClock(range.startMin),
              end: formatClock(range.endMin),
              focus: s?.focus?.toFixed(1) ?? '—',
            })}
          </p>
          <p className="text-xs text-ink-muted">{t('progress.slotAction.persistent')}</p>
          <Button
            className="btn-primary min-h-11 rounded-full"
            disabled={apply.isPending}
            onClick={() =>
              apply.mutate(a, {
                onSuccess: () => {
                  record.mutate({
                    candidateId: c.id,
                    status: 'accepted',
                    payload: { action: a, week: weekWindow(data.today).nextFrom },
                  })
                  snooze(c.id, addDays(data.today, 14))
                },
              })
            }
          >
            {t(a.kind === 'avoid_slot' ? 'progress.slotAction.remove' : 'progress.slotAction.add')}
          </Button>
          <button
            className="min-h-11 text-sm text-brand"
            type="button"
            onClick={() => {
              record.mutate({ candidateId: c.id, status: 'rejected', payload: { action: a } })
              snooze(c.id, addDays(data.today, 14))
            }}
          >
            {t('progress.rhythm.later')}
          </button>
        </section>
      )
    })
}

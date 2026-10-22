import { useTranslation } from 'react-i18next'
import { formatDuration } from '@/features/sources/format'
import type { PlanToday } from './usePlanToday'

/** Ring of today's progress: studied of planned minutes. */
function Ring({ value }: { value: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-track" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${c * Math.min(1, value)} ${c}`}
        transform="rotate(-90 28 28)"
        className="stroke-brand-accent"
      />
    </svg>
  )
}

function Stat({
  label,
  value,
  rest,
  tone,
}: {
  label: string
  value: string
  rest?: string
  tone: string
}) {
  return (
    <div className="flex flex-col gap-px">
      <span className={`text-xs font-semibold ${tone}`}>{label}</span>
      <span className="text-xl font-semibold tabular-nums">
        {value}
        {rest && <span className="text-sm font-medium text-ink-secondary"> / {rest}</span>}
      </span>
    </div>
  )
}

/** Fokus traka on Danas: today, this week, the next exam and readiness. */
export function FocusBar({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const ratio = plan.plannedToday > 0 ? plan.doneToday / plan.plannedToday : 0
  return (
    <section className="glass flex items-center gap-4 rounded-card-lg p-[18px]">
      <Ring value={ratio} />
      <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2.5">
        <Stat
          label={t('today.focus.today')}
          tone="text-brand"
          value={String(plan.doneToday)}
          rest={String(plan.plannedToday)}
        />
        <Stat
          label={t('today.focus.week')}
          tone="text-subject-pink-deep"
          value={formatDuration(t, plan.doneWeek)}
          rest={formatDuration(t, plan.plannedWeek)}
        />
        <Stat
          label={t('today.focus.nextExam')}
          tone="text-ink-secondary"
          value={
            plan.nextExamDays === null ? '—' : t('today.focus.days', { count: plan.nextExamDays })
          }
        />
        <Stat
          label={t('today.focus.readiness')}
          tone="text-ink-secondary"
          value={plan.readiness === null ? '—' : `${plan.readiness}%`}
        />
      </div>
    </section>
  )
}

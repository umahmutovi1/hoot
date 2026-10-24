import { useTranslation } from 'react-i18next'
import { formatDuration } from '@/features/sources/format'
import type { PlanToday } from './usePlanToday'

function Arc({ r, value, className }: { r: number; value: number; className: string }) {
  const c = 2 * Math.PI * r
  return (
    <>
      <circle cx="38" cy="38" r={r} fill="none" strokeWidth="9" className="stroke-track" />
      {value > 0 && (
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${c * Math.min(1, value)} ${c}`}
          transform="rotate(-90 38 38)"
          className={className}
        />
      )}
    </>
  )
}

/** Two rings (Danas.dc.html): outer today's plan, inner this week, studied of planned minutes. */
function Rings({ today, week }: { today: number; week: number }) {
  return (
    <svg width="80" height="80" viewBox="0 0 76 76" aria-hidden="true" className="shrink-0">
      <Arc r={32} value={today} className="stroke-brand-accent" />
      <Arc r={20} value={week} className="stroke-subject-pink" />
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
        {rest && (
          <span className="text-sm font-medium whitespace-nowrap text-ink-secondary">
            {' '}
            / {rest}
          </span>
        )}
      </span>
    </div>
  )
}

/** Fokus traka on Danas: today, this week, the next exam and readiness. */
export function FocusBar({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const ratio = (done: number, planned: number) => (planned > 0 ? done / planned : 0)
  return (
    <section className="glass flex items-center gap-4 rounded-card-lg p-[18px]">
      <Rings
        today={ratio(plan.doneToday, plan.plannedToday)}
        week={ratio(plan.doneWeek, plan.plannedWeek)}
      />
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

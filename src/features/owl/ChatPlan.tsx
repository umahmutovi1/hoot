import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { AiSparkIcon, CheckIcon, LockIcon } from '@/components/icons'
import { useAllSources } from '@/features/plan/api'
import { useStartBlock } from '@/features/plan/actions'
import { blockSub, nextBlock } from '@/features/plan/model'
import { useDayBlocks } from '@/features/plan/useDayBlocks'
import { useActiveSession } from '@/features/session/api'
import { useProfile } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { formatDuration } from '@/features/sources/format'
import { materialOf, rateOf, subjectMaterialProgress } from '@/features/sources/model'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { usePlanToday, type PlanToday } from '@/features/today/usePlanToday'
import { diffDays, localDay, toDisplayDate, type LocalDate } from '@/lib/day'
import { greetingPart } from '@/lib/greeting'
import { dateFnsLocales } from '@/lib/locale'
import { formatClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'

const card = 'glass flex flex-col overflow-hidden rounded-[22px]'
const divider = <div className="mx-4 h-px bg-line/90" />

/**
 * The plan at the top of the chat (Chat.dc.html): a greeting with today's planned time, today's
 * blocks from the saved plan (Počni on the next one) and the next three goals. Read from the
 * saved blocks and the last computed plan; no AI call.
 */
export function ChatPlan() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: profile } = useProfile()
  const plan = usePlanToday()
  const { data: subjects = [] } = useSubjects()
  if (!plan.loaded || !subjects.some((s) => !s.archived)) return null

  const open = plan.todayBlocks.filter((b) => b.status !== 'skipped')
  const dayOff = open.length === 0 && plan.todayBlocks.length > 0
  const greeting = t(`today.greeting.${greetingPart(plan.now.getHours())}`, {
    name: profile?.display_name ?? '',
  })
  const summary = dayOff
    ? t('owl.plan.dayOff')
    : open.length === 0
      ? t('owl.plan.free')
      : t('owl.plan.today', { time: formatDuration(t, plan.plannedToday) })

  return (
    <div className="flex flex-col gap-3">
      <span className="self-center text-xs font-semibold text-ink-muted first-letter:uppercase">
        {format(plan.now, 'EEEE, d. MMMM · HH:mm', { locale: dateFnsLocales[locale] })}
      </span>
      <div className="flex gap-2.5">
        <span
          aria-hidden="true"
          className="icon-tile flex size-8 shrink-0 items-center justify-center rounded-full"
        >
          <AiSparkIcon size={15} />
        </span>
        <p className="flex-1 pt-1 text-[15px] leading-[1.45]">
          {greeting}. {summary}
        </p>
      </div>
      {open.length > 0 && <TodayCard plan={plan} />}
      <SoonCard plan={plan} />
    </div>
  )
}

function TodayCard({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const { blocksFor } = useDayBlocks()
  const { data: active } = useActiveSession()
  const start = useStartBlock()
  const [busy, setBusy] = useState(false)
  const rows = blocksFor(plan.today).sort((a, b) => (a.startMin ?? 9999) - (b.startMin ?? 9999))
  const next = nextBlock(plan.todayBlocks, plan.nowMin)
  const done = rows.filter((r) => r.done).length

  return (
    <section className={card} aria-label={t('owl.plan.todayTitle')}>
      <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
        <span className="text-[15px] font-semibold">{t('owl.plan.todayTitle')}</span>
        <span className="text-xs text-ink-muted">
          {t('owl.plan.doneOf', { done, total: rows.length })}
        </span>
      </div>
      {rows.map((row, i) => {
        const current = next?.id === row.block.id
        const canStart = current && !active && !busy
        return (
          <div key={row.block.id}>
            {i > 0 && divider}
            <div
              className={cn(
                'flex min-h-12 items-center gap-3 px-4 py-2.5',
                current && 'bg-canvas-soft',
              )}
            >
              <span
                className={cn(
                  'w-11 shrink-0 text-[13px] tabular-nums',
                  current ? 'font-bold text-brand' : 'font-medium text-ink-muted',
                )}
              >
                {row.startMin === null ? '—' : formatClock(row.startMin)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span
                  className={cn(
                    'truncate text-[15px]',
                    current ? 'font-semibold' : row.done && 'text-ink-muted line-through',
                  )}
                >
                  {row.manual && (
                    <LockIcon size={12} className="mr-1 inline align-[-1px] text-ink-muted" />
                  )}
                  {row.title}
                </span>
                {current && (
                  <span className="truncate text-xs text-ink-secondary">
                    {blockSub(t, row.block, plan.units)}
                  </span>
                )}
              </span>
              {row.done ? (
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <CheckIcon size={13} />
                </span>
              ) : canStart ? (
                <button
                  type="button"
                  onClick={() => {
                    setBusy(true)
                    void start(row.block, plan.units).finally(() => setBusy(false))
                  }}
                  className="btn-primary flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold"
                >
                  {t('today.next.start')}
                </button>
              ) : (
                <span className="shrink-0 text-[13px] text-ink-muted tabular-nums">
                  {formatDuration(t, row.block.planned_minutes)}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}

interface Goal {
  id: string
  on: LocalDate
  title: string
  subjectId: string | null
  /** Left to do on a deadline with an estimate (minutes). */
  left: number | null
  exam: boolean
}

/** "Uskoro": the next three exams and deadlines, with the plan's verdict and material progress. */
function SoonCard({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const today = plan.today
  const { data: subjects = [] } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  const { data: sources = [] } = useAllSources()
  const dateOf = (iso: string) => localDay(new Date(iso), { ...plan.boundary, dayStartMin: 0 })
  const live = subjects.filter((s) => !s.archived)

  const goals: Goal[] = [
    ...live.flatMap((s) =>
      s.assessments
        .filter((a) => !a.passed && !a.contingent)
        .map((a) => ({
          id: a.id,
          on: dateOf(a.at),
          title: a.title,
          subjectId: s.id,
          left: null,
          exam: true,
        })),
    ),
    ...deadlines
      .filter((d) => !d.done && (!d.subject_id || live.some((s) => s.id === d.subject_id)))
      .map((d) => ({
        id: d.id,
        on: dateOf(d.due_at),
        title: d.title,
        subjectId: d.subject_id,
        left: d.est_minutes === null ? null : Math.max(0, d.est_minutes - d.done_minutes),
        exam: false,
      })),
  ]
    .filter((g) => g.on >= today)
    .sort((a, b) => a.on.localeCompare(b.on))
    .slice(0, 3)
  if (goals.length === 0) return null

  const deficits = plan.model?.result.deficits ?? []
  const progress = (subjectId: string) => {
    const own = sources.filter((s) => s.subject_id === subjectId)
    if (own.length === 0) return null
    return Math.round(
      subjectMaterialProgress(own.map((s) => materialOf(s, rateOf(s, sources).mean))) * 100,
    )
  }

  return (
    <section className={card} aria-label={t('owl.plan.soonTitle')}>
      <div className="px-4 pt-3.5 pb-2">
        <span className="text-[15px] font-semibold">{t('owl.plan.soonTitle')}</span>
      </div>
      {goals.map((g, i) => {
        const subject = live.find((s) => s.id === g.subjectId)
        const days = diffDays(today, g.on)
        const deficit = deficits.find((d) => d.goalId === g.id)
        const status = deficit
          ? t('owl.plan.short', { time: formatDuration(t, deficit.minutes) })
          : g.left
            ? t('owl.plan.left', { time: formatDuration(t, g.left) })
            : plan.model
              ? t('owl.plan.onTrack')
              : null
        const pct = g.exam && subject ? progress(subject.id) : null
        const date = toDisplayDate(g.on)
        return (
          <div key={g.id}>
            {i > 0 && divider}
            <Link
              to={subject ? `/subjects/${subject.id}` : '/plan'}
              className="flex min-h-12 items-center gap-3 px-4 py-2.5"
            >
              <span className="flex w-11 shrink-0 flex-col items-center leading-none">
                <span
                  className={cn(
                    'text-[11px] font-semibold uppercase',
                    paletteOf(subject?.color ?? null).deepText,
                  )}
                >
                  {format(date, 'MMM', { locale: dateFnsLocales[locale] })}
                </span>
                <span className="text-lg font-semibold tabular-nums">{format(date, 'd')}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-[15px] font-medium">
                  {subject ? `${g.title} · ${subject.name.split(' ')[0]}` : g.title}
                </span>
                <span
                  className={cn(
                    'truncate text-xs',
                    deficit ? 'text-warning' : 'text-ink-secondary',
                  )}
                >
                  {[
                    days === 0
                      ? t('owl.plan.dueToday')
                      : days === 1
                        ? t('owl.plan.dueTomorrow')
                        : t('owl.plan.inDays', { count: days }),
                    status,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {pct !== null && (
                <span className="shrink-0 text-sm font-semibold tabular-nums">{pct}%</span>
              )}
            </Link>
          </div>
        )
      })}
    </section>
  )
}

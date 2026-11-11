import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ChevronRightIcon, PlusIcon } from '@/components/icons'
import { BlockSheet } from '@/features/plan/BlockSheet'
import { cn } from '@/lib/utils'
import { useStartBlock } from '@/features/plan/actions'
import { useAllSources } from '@/features/plan/api'
import {
  blockMode,
  blockPages,
  blockTitle,
  clockOf,
  isOpen,
  nextBlock,
  reasonText,
  useGoalTitle,
} from '@/features/plan/model'
import type { PlanBlockRow } from '@/features/plan/state'
import { useActiveSession } from '@/features/session/api'
import { formatClock, toSegment } from '@/features/session/model'
import { useNow } from '@/features/session/useNow'
import { useLocale } from '@/features/settings/useLocale'
import { formatDuration } from '@/features/sources/format'
import { useSubject, useSubjects } from '@/features/subjects/api'
import { addDays, toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { LATE_AFTER_MIN } from '@/lib/scheduler'
import { activeMs, openSegment } from '@/lib/session/timer'
import type { ActiveSession } from '@/features/session/model'
import { SkipSheet } from './SkipSheet'
import type { PlanToday } from './usePlanToday'

const label = 'text-sm font-bold text-brand-strong'
const action =
  'btn-primary flex h-[52px] items-center gap-2.5 rounded-2xl px-6 text-[17px] font-bold'
/** The title of the card's block or state (30 px display, DanasA). */
const title = 'font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]'

function PlayIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
      <path d="M1 1.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 1 1.5z" />
    </svg>
  )
}

/**
 * "Sljedeće" on Today (hero card): the session running now, else the next block of today's
 * plan (Počni starts its session with its planned length), else a free session.
 */
export function NextCard({ plan }: { plan: PlanToday }) {
  const { data: active } = useActiveSession()
  if (active) return <RunningCard data={active} />
  if (!plan.loaded) return <PendingCard />
  const next = nextBlock(plan.todayBlocks, plan.nowMin)
  if (next) return <BlockCard block={next} plan={plan} />
  return <FreeCard plan={plan} />
}

/** Same card while the saved blocks load, so Today does not jump from one layout to another. */
function PendingCard() {
  const { t } = useTranslation()
  return (
    <section className="next-card flex min-h-[176px] flex-col gap-4 rounded-card-lg p-5">
      <span className={label}>{t('today.next.label')}</span>
      <span className="h-6 w-2/3 animate-pulse rounded-full bg-ground/60" />
    </section>
  )
}

/** "Danas ne mogu" is on: today is free, the plan moved on from tomorrow. */
export function DayOffCard({ moved }: { moved: number }) {
  const { t } = useTranslation()
  return (
    <section className="next-card flex flex-col gap-1.5 rounded-card-lg p-5">
      <span className={label}>{t('today.cant.label')}</span>
      <span className={title}>{t('today.cant.title')}</span>
      <span className="text-[15px] text-brand-strong">
        {t('today.cant.moved', { count: moved })}
      </span>
    </section>
  )
}

function BlockCard({ block, plan }: { block: PlanBlockRow; plan: PlanToday }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const start = useStartBlock()
  const { data: subjects = [] } = useSubjects()
  const subject = subjects.find((s) => s.id === block.subject_id)
  const goalTitle = useGoalTitle()
  const why = reasonText(t, block, {
    goalTitle,
    formatDate: (d) => format(toDisplayDate(d), 'd. MMM', { locale: dateFnsLocales[locale] }),
  })
  const pages = blockPages(t, block, plan.units)
  const clock = clockOf(block)
  const [skipping, setSkipping] = useState(false)
  const lateMin =
    block.status === 'planned' && block.start_min !== null ? plan.nowMin - block.start_min : 0
  const late = lateMin > LATE_AFTER_MIN
  return (
    <section className="next-card flex flex-col gap-4 rounded-card-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <span className={label}>
          {late
            ? t('today.skip.late', { min: lateMin })
            : clock
              ? t('today.next.labelAt', { time: clock })
              : t('today.next.label')}
        </span>
        <span className="flex h-7 items-center rounded-full bg-ground/70 px-3 text-[13px] font-bold text-brand-strong tabular-nums">
          {formatDuration(t, block.planned_minutes)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className={title}>
          {blockTitle(t, block, plan.units, goalTitle(block.deadline_id ?? ''))}
        </span>
        <span className="text-[15px] text-brand-strong">
          {[
            subject?.name,
            t(
              `planBlocks.mode.${block.kind === 'learn' ? blockMode(block, plan.units) : block.kind}`,
            ),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {(pages || why) && (
          <span className="text-[13px] text-ink-secondary">
            {[pages, why].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void start(block, plan.units)}
          className={`${action} whitespace-nowrap`}
        >
          <PlayIcon />
          {late ? t('today.skip.startNow') : t('today.next.start')}
        </button>
        {block.status === 'planned' && (
          <button
            type="button"
            onClick={() => setSkipping(true)}
            className="flex h-[52px] items-center px-3.5 text-[15px] font-bold text-brand-strong"
          >
            {t('today.skip.button')}
          </button>
        )}
      </div>
      <SkipSheet block={skipping ? block : null} plan={plan} onClose={() => setSkipping(false)} />
    </section>
  )
}

/**
 * No block left today (DanasSlobodno, decision after Sprint 9b: in the same card, not a separate empty
 * screen): the next planned block (tomorrow or later) and "Dodaj sesiju", or "Predmeti" when the
 * plan has no material yet.
 */
function FreeCard({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: subjects = [] } = useSubjects()
  const { data: sources } = useAllSources()
  const goalTitle = useGoalTitle()
  const done = plan.todayBlocks.some((b) => b.status === 'done')
  const [extra, setExtra] = useState(false)
  const noMaterial =
    sources !== undefined && !sources.some((s) => s.units.some((u) => u.archived_at === null))
  const later = plan.blocks
    .filter((b) => b.on_date > plan.today && isOpen(b))
    .sort(
      (a, b) => a.on_date.localeCompare(b.on_date) || (a.start_min ?? 0) - (b.start_min ?? 0),
    )[0]
  const when = later
    ? later.on_date === addDays(plan.today, 1)
      ? t('today.free.tomorrow')
      : format(toDisplayDate(later.on_date), 'EEEE', { locale: dateFnsLocales[locale] })
    : null
  const heading = done
    ? t('today.next.allDone')
    : noMaterial
      ? t('today.free.noMaterialTitle')
      : t('today.free.title')
  const sub = noMaterial
    ? t('today.free.noMaterialBody')
    : later && when
      ? t('today.free.next', {
          when,
          time: clockOf(later) ?? '',
          subject: `${(subjects.find((x) => x.id === later.subject_id)?.name ?? '').split(' ')[0]} — ${blockTitle(t, later, plan.units, goalTitle(later.deadline_id ?? ''))}`,
        })
      : done
        ? t('today.next.allDoneSub')
        : t('today.next.freeSub')
  return (
    <section className="next-card flex min-h-[176px] flex-col gap-4 rounded-card-lg p-5">
      <span className={label}>{t('today.next.label')}</span>
      <div className="flex flex-col gap-1">
        <span className={title}>{heading}</span>
        <span className="text-[15px] text-brand-strong">{sub}</span>
      </div>
      {/* One button bottom right, like "Počni" on a block (feedback after Sprint 13): "Dodaj sesiju" is
          the add-block flow (the plan's suggestion, then "Započeti odmah?"), which replaced the
          free session here; without material it leads to Predmeti. */}
      {noMaterial ? (
        <Link to="/subjects" className={cn(action, 'self-start')}>
          {t('today.free.addMaterial')}
        </Link>
      ) : (
        <button type="button" onClick={() => setExtra(true)} className={cn(action, 'self-start')}>
          <PlusIcon size={16} />
          {t('today.free.addSession')}
        </button>
      )}
      <BlockSheet
        open={extra}
        onOpenChange={setExtra}
        block={null}
        date={plan.today}
        today={plan.today}
      />
    </section>
  )
}

function RunningCard({ data }: { data: ActiveSession }) {
  const { t } = useTranslation()
  const now = useNow()
  const { data: subject } = useSubject(data.session.subject_id)
  const list = data.segments.map(toSegment)
  const running = Boolean(openSegment(list))
  // The whole card opens the session; finishing or discarding happens there (decision, Sprint 12).
  return (
    <Link
      to="/session"
      aria-label={t('today.next.open')}
      className="hero flex flex-col gap-4 rounded-card-lg p-5 active:scale-[0.99]"
    >
      <span className="text-sm font-bold text-ground/80">
        {running ? t('today.next.running') : t('today.next.paused')}
      </span>
      <span className="text-[22px] leading-tight font-semibold tracking-[-0.5px]">
        {subject?.name ?? t('session.title')}
      </span>
      <div className="flex items-center justify-between">
        <span className="text-[40px] font-semibold tracking-[-1.2px] tabular-nums">
          {formatClock(activeMs(list, now))}
        </span>
        <span className="flex size-12 items-center justify-center rounded-full bg-ground/18">
          <ChevronRightIcon size={22} />
        </span>
      </div>
    </Link>
  )
}

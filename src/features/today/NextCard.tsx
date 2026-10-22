import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
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
import { useSessionUi } from '@/features/session/store'
import { useNow } from '@/features/session/useNow'
import { useLocale } from '@/features/settings/useLocale'
import { useSubject, useSubjects } from '@/features/subjects/api'
import { addDays, toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { activeMs, MINUTE, openSegment } from '@/lib/session/timer'
import type { ActiveSession } from '@/features/session/model'
import { ExtraTimeSheet } from './ExtraTimeSheet'
import type { PlanToday } from './usePlanToday'

const label = 'text-xs font-semibold tracking-[0.6px] text-white/88 uppercase'
const action =
  'flex h-12 items-center gap-2 rounded-full bg-white/94 px-6 text-base font-semibold text-brand-strong shadow-[inset_0_1px_1px_#fff,0_6px_16px_rgba(30,20,80,0.2)]'

function PlayIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
      <path d="M1 1.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 1 1.5z" />
    </svg>
  )
}

/**
 * "Sljedeće" on Today (glass-tint card): the session running now, else the next block of today's
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
    <section className="glass-tint flex min-h-[176px] flex-col gap-4 rounded-card-lg p-5">
      <span className={label}>{t('today.next.label')}</span>
      <span className="h-6 w-2/3 animate-pulse rounded-full bg-white/20" />
    </section>
  )
}

/** "Danas ne mogu" is on: today is free, the plan moved on from tomorrow. */
export function DayOffCard({ moved }: { moved: number }) {
  const { t } = useTranslation()
  return (
    <section className="glass-tint flex flex-col gap-1 rounded-card p-4">
      <span className={label}>{t('today.cant.label')}</span>
      <span className="text-[22px] font-bold">{t('today.cant.title')}</span>
      <span className="text-sm text-white/82">{t('today.cant.moved', { count: moved })}</span>
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
  return (
    <section className="glass-tint flex flex-col gap-4 rounded-card-lg p-5">
      <div className="flex items-center justify-between">
        <span className={label}>
          {clock ? t('today.next.labelAt', { time: clock }) : t('today.next.label')}
        </span>
        <span className="flex h-[26px] items-center rounded-full bg-white/18 px-2.5 text-xs font-semibold shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)]">
          {t(
            `planBlocks.mode.${block.kind === 'learn' ? blockMode(block, plan.units) : block.kind}`,
          )}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-white/88">{subject?.name}</span>
        <span className="text-[22px] leading-[1.2] font-semibold tracking-[-0.5px]">
          {blockTitle(t, block, plan.units, goalTitle(block.deadline_id ?? ''))}
        </span>
        {(pages || why) && (
          <span className="text-[13px] text-white/84">
            {[pages, why].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[40px] font-semibold tracking-[-1.2px] tabular-nums">
          {formatClock(block.planned_minutes * MINUTE)}
        </span>
        <button type="button" onClick={() => void start(block, plan.units)} className={action}>
          <PlayIcon />
          {t('today.next.start')}
        </button>
      </div>
    </section>
  )
}

/**
 * No block left today (DanasSlobodno, decision after 8b: in the same card, not a separate empty
 * screen): the next planned block (tomorrow or later), "Imam još vremena", a free session, and
 * "Predmeti" when the plan has no material yet.
 */
function FreeCard({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const openStart = useSessionUi((s) => s.openStart)
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
  const title = done
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
    <section className="glass-tint flex min-h-[176px] flex-col gap-4 rounded-card-lg p-5">
      <span className={label}>{t('today.next.label')}</span>
      <div className="flex flex-col gap-1">
        <span className="text-[22px] leading-tight font-semibold tracking-[-0.5px]">{title}</span>
        <span className="text-[13px] text-white/84">{sub}</span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!noMaterial && (
          <button
            type="button"
            onClick={() => setExtra(true)}
            className="flex h-12 items-center rounded-full bg-white/18 px-5 text-base font-semibold shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)]"
          >
            {t('today.extra.button')}
          </button>
        )}
        {noMaterial && (
          <Link
            to="/subjects"
            className="flex h-12 items-center rounded-full bg-white/18 px-5 text-base font-semibold shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)]"
          >
            {t('today.free.addMaterial')}
          </Link>
        )}
        <button type="button" onClick={openStart} className={action}>
          <PlayIcon />
          {t('today.next.freeTitle')}
        </button>
      </div>
      <ExtraTimeSheet open={extra} onOpenChange={setExtra} plan={plan} />
    </section>
  )
}

function RunningCard({ data }: { data: ActiveSession }) {
  const { t } = useTranslation()
  const now = useNow()
  const { data: subject } = useSubject(data.session.subject_id)
  const list = data.segments.map(toSegment)
  const running = Boolean(openSegment(list))
  return (
    <section className="glass-tint flex flex-col gap-4 rounded-card-lg p-5">
      <span className={label}>{running ? t('today.next.running') : t('today.next.paused')}</span>
      <span className="text-[22px] leading-tight font-semibold tracking-[-0.5px]">
        {subject?.name ?? t('session.title')}
      </span>
      <div className="flex items-center justify-between">
        <span className="text-[40px] font-semibold tracking-[-1.2px] tabular-nums">
          {formatClock(activeMs(list, now))}
        </span>
        <Link to="/session" className={action}>
          <PlayIcon />
          {t('today.next.resume')}
        </Link>
      </div>
    </section>
  )
}

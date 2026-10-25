import { MoodleCard } from '@/features/calendars/MoodleCard'
import { useDeadlineProposals } from '@/features/calendars/moodle'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { SparkleIcon } from '@/components/icons'
import { blockTitle, movedBlocks, nextBlock, reasonText, useGoalTitle } from '@/features/plan/model'
import { ReplanSheet } from '@/features/plan/ReplanSheet'
import type { PlanBlockRow } from '@/features/plan/state'
import { SuggestionCard } from '@/features/plan/SuggestionCard'
import { useSuggestions } from '@/features/plan/useSuggestions'
import { usePlanUi } from '@/features/plan/ui'
import { statusLabel } from '@/features/schedule/format'
import { LecturePromptCard } from '@/features/schedule/LecturePrompts'
import { usePendingLectures } from '@/features/schedule/usePendingLectures'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useSubjects } from '@/features/subjects/api'
import { useProfile } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { addDays, toDisplayDate } from '@/lib/day'
import { greetingPart } from '@/lib/greeting'
import { calendarStatus, formatClock } from '@/lib/schedule'
import { dateFnsLocales } from '@/lib/locale'
import { SetupChecklist } from '@/features/onboarding/SetupChecklist'
import { ExamTiles } from './ExamTiles'
import { BlockSheet } from '@/features/plan/BlockSheet'
import { FactCard } from './FactCard'
import { FocusBar } from './FocusBar'
import { GainedCard } from './GainedCard'
import { useGainedCard } from './useGainedCard'
import { DayOffCard, NextCard } from './NextCard'
import { QuickActions } from './QuickActions'
import { TodaySchedule } from './TodaySchedule'
import { usePlanToday, type PlanToday } from './usePlanToday'

// "Znaš li?" is switched off for now: Today gets crowded once the plan and its cards arrive
// (decision after Stage 7). The card and the facts stay; set to true to bring it back.
const SHOW_FACT_CARD = false

/**
 * Danas: the focus bar, the next block ("Sljedeće", Počni starts its session), quick actions,
 * at most one action card (the rest under "Još N prijedloga"), why the day looks like this,
 * today's schedule and the next exams. Without subjects it is the first-run state. A day without
 * blocks keeps the same layout ("Sljedeće" shows the next planned block and a free session);
 * after "Danas ne mogu" it shows what moved.
 */
export function TodayPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: profile } = useProfile()
  const plan = usePlanToday()
  // `?extra=1` (search: "Imam još vremena") opens that sheet.
  const [params, setParams] = useSearchParams()
  const name = profile?.display_name ?? ''
  const { periods, dayRows } = useScheduleData()
  const status = calendarStatus(plan.today, periods)
  const { data: subjects, isPending } = useSubjects()
  const hasSubjects = (subjects ?? []).some((x) => !x.archived)
  // Without a cached copy the first load would flash the first-run state before the subjects come.
  const firstRun = !isPending && !hasSubjects
  const dayOff =
    plan.todayBlocks.some((b) => b.status === 'skipped') &&
    dayRows.some((d) => d.on_date === plan.today && Array.isArray(d.slots) && d.slots.length === 0)

  return (
    <div className="flex flex-col pb-8">
      <div className="mt-1.5 flex flex-col gap-0.5 px-1">
        <span className="text-[13px] font-semibold tracking-[0.2px] text-ink-secondary">
          <span className="uppercase">
            {format(toDisplayDate(plan.today), 'EEEE, d. MMMM', { locale: dateFnsLocales[locale] })}
          </span>
          {status && (
            <>
              {' · '}
              <Link to="/settings/calendar" className="text-brand">
                {statusLabel(t, status)}
              </Link>
            </>
          )}
        </span>
        <h1 className="text-[36px] leading-[1.1] font-bold tracking-[-0.9px]">{t('nav.today')}</h1>
        {firstRun && (
          <span className="mt-1 text-[17px] font-semibold">
            {t(`today.greeting.${greetingPart(plan.now.getHours())}`, { name })}
          </span>
        )}
      </div>

      {hasSubjects ? (
        <>
          <div className="mt-4">
            <FocusBar plan={plan} />
          </div>
          <div className="mt-3.5">
            {dayOff ? (
              <DayOffCard moved={plan.todayBlocks.filter((b) => b.status === 'skipped').length} />
            ) : (
              <NextCard plan={plan} />
            )}
          </div>
          {dayOff && <MovedCard plan={plan} />}
          <div className="mt-3 empty:hidden">
            <QuickActions plan={plan} dayOff={dayOff} />
          </div>
          <ActionCards plan={plan} />
          {!dayOff && <WhyToday plan={plan} />}
          <TodaySchedule plan={plan} />
          <ExamTiles now={plan.now} />
          <BlockSheet
            open={params.get('extra') === '1'}
            onOpenChange={(o) => !o && setParams({}, { replace: true })}
            block={null}
            date={plan.today}
            today={plan.today}
          />
        </>
      ) : firstRun ? (
        <section className="mt-16 flex flex-col items-center gap-3.5 px-3 text-center">
          <h2 className="text-[26px] leading-tight font-bold">{t('today.firstRunTitle')}</h2>
          <p className="text-[15px] leading-[1.45] text-ink-secondary">{t('today.firstRunBody')}</p>
          <Link
            to="/subjects/new"
            className="btn-primary mt-2 flex h-14 items-center rounded-full px-7 text-base font-semibold"
          >
            {t('today.addSubject')}
          </Link>
        </section>
      ) : null}
      {firstRun && (
        <div className="mt-8">
          <SetupChecklist />
        </div>
      )}
      <AutoReplanSheet plan={plan} />

      {SHOW_FACT_CARD && (
        <div className="mt-10">
          <FactCard />
        </div>
      )}
    </div>
  )
}

/** After "Danas ne mogu": where today's blocks went. */
function MovedCard({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: subjects = [] } = useSubjects()
  const goalTitle = useGoalTitle()
  const skipped = plan.todayBlocks.filter((b) => b.status === 'skipped')
  const moved = movedBlocks(skipped, plan.blocks, addDays(plan.today, 1))
  if (moved.length === 0) return null
  const growth = plan.model?.built.state.growthBase !== null
  const onTrack = (plan.model?.result.deficits.length ?? 0) === 0
  return (
    <section className="glass mt-3 flex flex-col gap-2.5 rounded-card p-4">
      <span className="text-[15px] font-semibold">{t('today.cant.whatMoved')}</span>
      <div className="flex flex-col gap-2 text-sm">
        {moved.map(({ block, to }) => (
          <div key={block.id} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              {(subjects.find((s) => s.id === block.subject_id)?.name ?? '').split(' ')[0]} —{' '}
              {blockTitle(t, block, plan.units, goalTitle(block.deadline_id ?? ''))}
            </span>
            <span className="shrink-0 font-semibold text-brand">
              {to
                ? `→ ${format(toDisplayDate(to.on_date), 'EEE', { locale: dateFnsLocales[locale] })}${
                    to.start_min === null ? '' : ` ${formatClock(to.start_min)}`
                  }`
                : t('replan.notPlanned')}
            </span>
          </div>
        ))}
      </div>
      {(growth || onTrack) && (
        <span className="text-xs text-ink-muted">
          {[growth ? t('today.cant.growth') : null, onTrack ? t('today.cant.onTrack') : null]
            .filter(Boolean)
            .join(' ')}
        </span>
      )}
    </section>
  )
}

/** At most one action card above the schedule; the rest open under "Još N prijedloga". */
function ActionCards({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const gained = useGainedCard(plan)
  const lectures = usePendingLectures()
  const suggestions = useSuggestions()
  const [more, setMore] = useState(false)
  const urgent = suggestions.filter((s) => s.kind === 'fresh_start' || s.kind === 'deficit')
  const rest = suggestions.filter((s) => s.kind !== 'fresh_start' && s.kind !== 'deficit')
  const moodle = useDeadlineProposals()
  const cards = [
    ...urgent.map((s) => <SuggestionCard key={s.key} suggestion={s} />),
    ...(gained ? [<GainedCard key="gained" plan={plan} />] : []),
    ...lectures.pending.map((l) => (
      <LecturePromptCard
        key={l.entry.id}
        lecture={l}
        today={lectures.today}
        onSkip={lectures.refresh}
      />
    )),
    ...(moodle.length > 0 ? [<MoodleCard key="moodle" proposals={moodle} />] : []),
    ...rest.map((s) => <SuggestionCard key={s.key} suggestion={s} />),
  ]
  if (cards.length === 0) return null
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {cards[0]}
      {cards.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setMore(!more)}
            aria-expanded={more}
            className="h-9 text-[13px] font-semibold text-brand"
          >
            {more ? t('today.moreHide') : t('today.more', { count: cards.length - 1 })}
          </button>
          {more && cards.slice(1)}
        </>
      )}
    </div>
  )
}

/** "Zašto ovako danas": the rule behind the next block, and the realization factor. */
function WhyToday({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const goalTitle = useGoalTitle()
  const { locale } = useLocale()
  const { data: subjects = [] } = useSubjects()
  const next = nextBlock(plan.todayBlocks, plan.nowMin)
  const real = plan.model?.built.realization
  const subject = subjects.find((s) => s.id === next?.subject_id)
  const why = next
    ? reasonText(t, next, {
        goalTitle,
        formatDate: (d) => format(toDisplayDate(d), 'd. MMM', { locale: dateFnsLocales[locale] }),
      })
    : null
  const rho =
    real && real.days > 0 && real.rho < 1
      ? t('today.why.rho', { pct: Math.round(real.rho * 100) })
      : null
  if (!why && !rho) return null
  return (
    <Link
      to="/chat"
      className="mt-2.5 flex items-start gap-2.5 rounded-[20px] bg-white/28 px-3.5 py-3 text-ink"
    >
      <SparkleIcon size={16} className="mt-px shrink-0 text-brand-accent" />
      <span className="flex-1 text-[13px] leading-[1.4] text-ink-secondary">
        <b className="text-ink">{t('today.why.title')}</b>{' '}
        {[why && subject ? `${subject.name}: ${why}.` : null, rho].filter(Boolean).join(' ')}
      </span>
    </Link>
  )
}

/** "Plan je ažuriran" once a day, when yesterday had missed blocks (not after a fresh start). */
function AutoReplanSheet({ plan }: { plan: PlanToday }) {
  const shownOn = usePlanUi((s) => s.replanShownOn)
  const markShown = usePlanUi((s) => s.markReplanShown)
  const suggestions = useSuggestions()
  const yesterday = addDays(plan.today, -1)
  const missed: PlanBlockRow[] = plan.blocks.filter(
    (b) =>
      b.on_date === yesterday &&
      b.origin === 'ai' &&
      (b.status === 'missed' || b.status === 'planned'),
  )
  const fresh = suggestions.some((s) => s.kind === 'fresh_start')
  const ready = plan.model !== null && plan.model.built.today === plan.today
  const open = ready && shownOn !== plan.today && missed.length > 0 && !fresh
  return (
    <ReplanSheet open={open} onOpenChange={(o) => !o && markShown(plan.today)} missed={missed} />
  )
}

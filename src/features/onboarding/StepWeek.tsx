import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStartBlock } from '@/features/plan/actions'
import { useSpeeds } from '@/features/plan/api'
import { blockTitle } from '@/features/plan/model'
import { usePresets, presetName } from '@/features/session/presets'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useDayBoundary } from '@/features/settings/profile'
import { useSources } from '@/features/sources/api'
import { materialOf } from '@/features/sources/model'
import { formatDuration } from '@/features/sources/format'
import { useSubjects } from '@/features/subjects/api'
import { localDay } from '@/lib/day'
import { formatClock, studyMinutesBetween } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { StepTitle } from './OnboardingPage'
import { useFirstBlock } from './useFirstBlock'

/** Plan uses this share of free time until real data exists: ρ prior 0.8 × reserve 0.9. */
const PLANNED_SHARE = 0.8 * 0.9

/**
 * Step 8 "Tvoja sedmica": free hours a week, hours needed until the first exam and whether that
 * fits (with the plan's reserve), then today's first block from the plan that ReplanRunner
 * computes after step 7 ("Pokreni prvi blok" starts its session). Without a block today it
 * offers a free session for the subject.
 */
export function StepWeek({
  onStart,
  onToday,
  onBlockStart,
}: {
  onStart: () => void
  onToday: () => void
  /** Ends onboarding without leaving; the block's session navigates on. */
  onBlockStart: () => void
}) {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const schedule = useScheduleData()
  const { data: subjects = [] } = useSubjects()
  const { resolve, defaultId } = usePresets()
  const next = subjects
    .filter((s) => !s.archived)
    .flatMap((s) =>
      s.assessments
        .filter((a) => !a.passed && !a.contingent)
        .map((a) => ({ subject: s, exam: a, on: localDay(new Date(a.at), boundary) })),
    )
    .filter((x) => x.on >= today)
    .sort((a, b) => a.on.localeCompare(b.on))[0]
  const { data: sources = [] } = useSources(next?.subject.id)
  const speeds = useSpeeds()
  const needed = sources.reduce(
    (sum, s) => sum + materialOf(s, speeds.get(s.id)).progress.remainingMinutes,
    0,
  )
  const weekly = schedule.weekMinutes(today)
  const until = next ? studyMinutesBetween(today, next.on, schedule.dayInput) * PLANNED_SHARE : 0
  const diff = Math.round(until - needed)
  const first = useFirstBlock(
    next
      ? {
          id: next.exam.id,
          subjectId: next.subject.id,
          hasMaterial: sources.some((src) => src.units.some((u) => u.archived_at === null)),
        }
      : null,
  )
  const startBlock = useStartBlock()
  const [starting, setStarting] = useState(false)
  const begin = () => {
    if (first.status !== 'block') return onStart()
    setStarting(true)
    onBlockStart()
    void startBlock(first.block, first.units).catch(() => setStarting(false))
  }

  return (
    <>
      <StepTitle title={t('onboarding.week.title')} sub={t('onboarding.week.sub')} />
      <div className="grid grid-cols-2 gap-2">
        <Stat value={formatDuration(t, weekly)} label={t('onboarding.week.free')} />
        {next && needed > 0 ? (
          <Stat
            value={formatDuration(t, Math.round(needed))}
            label={t('onboarding.week.needed', { exam: next.exam.title })}
          />
        ) : (
          <Stat value="—" label={t('onboarding.week.noExam')} />
        )}
      </div>
      {next && needed > 0 && (
        <div
          className={cn(
            'rounded-[20px] px-4 py-3 text-[15px] font-semibold',
            diff >= 0 ? 'bg-success-soft text-success-ink' : 'bg-warning-soft text-warning-ink',
          )}
        >
          {diff >= 0
            ? t('onboarding.week.fits', { time: formatDuration(t, diff) })
            : t('onboarding.week.short', { time: formatDuration(t, -diff) })}
        </div>
      )}
      {next && first.status !== 'none' && (
        <section className="glass-tint flex flex-col gap-3 rounded-card-lg p-5">
          {first.status === 'block' ? (
            <>
              <span className="text-xs font-semibold tracking-[0.6px] text-white/88 uppercase">
                {first.block.start_min === null
                  ? t('onboarding.week.firstBlock')
                  : t('onboarding.week.firstBlockAt', {
                      time: formatClock(first.block.start_min),
                    })}
              </span>
              <span className="text-[20px] leading-tight font-semibold">
                {subjects.find((x) => x.id === first.block.subject_id)?.name ?? next.subject.name}
              </span>
              <span className="text-[13px] text-white/84">
                {[
                  blockTitle(t, first.block, first.units, null),
                  formatDuration(t, first.block.planned_minutes),
                  presetName(t, resolve(defaultId)),
                ].join(' · ')}
              </span>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold tracking-[0.6px] text-white/88 uppercase">
                {t('onboarding.week.firstBlock')}
              </span>
              <span className="animate-pulse text-[15px] text-white/84">
                {t('onboarding.week.planning')}
              </span>
            </>
          )}
        </section>
      )}
      {next && first.status === 'none' && (
        <section className="glass-tint flex flex-col gap-3 rounded-card-lg p-5">
          <span className="text-xs font-semibold tracking-[0.6px] text-white/88 uppercase">
            {t('onboarding.week.firstSession')}
          </span>
          <span className="text-[20px] leading-tight font-semibold">{next.subject.name}</span>
          <span className="text-[13px] text-white/84">
            {presetName(t, resolve(defaultId))} · {t('onboarding.week.noBlockToday')}
          </span>
        </section>
      )}
      <span className="px-1 text-xs leading-[1.45] text-ink-muted">
        {t('onboarding.week.rough')}
      </span>
      <div className="mt-auto flex flex-col items-center gap-1 pt-2">
        <button
          type="button"
          onClick={next ? begin : onToday}
          disabled={Boolean(next) && (first.status === 'pending' || starting)}
          className="btn-primary h-14 w-full rounded-full text-base font-semibold disabled:opacity-60"
        >
          {!next
            ? t('onboarding.week.today')
            : first.status === 'none'
              ? t('onboarding.week.start')
              : t('onboarding.week.startBlock')}
        </button>
        {next && (
          <button
            type="button"
            onClick={onToday}
            className="h-11 px-3 text-sm font-semibold text-brand"
          >
            {t('onboarding.week.today')}
          </button>
        )}
      </div>
    </>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[22px] glass p-4">
      <span className="text-[26px] font-bold tracking-[-0.5px]">{value}</span>
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  )
}

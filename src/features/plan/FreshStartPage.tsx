import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { formatDuration } from '@/features/sources/format'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import { addDays, startOfWeek, toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { usePlanBlocks } from './api'
import { useGoalTitle } from './model'
import { ReplanSheet } from './ReplanSheet'
import { usePlanStore } from './store'

/**
 * "Krenimo ispočetka" (PRD "Novi početak"): after missed days, no list of what was missed — the
 * plan from today with a realistic pace, how the next exams look and one way to solve a deficit.
 * The text stays neutral (no "zaostaješ", no streaks).
 */
export function FreshStartPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const boundary = useDayBoundary()
  const model = usePlanStore((s) => s.model)
  const blocks = usePlanBlocks(boundary).data ?? []
  const { data: subjects = [] } = useSubjects()
  const [solve, setSolve] = useState(false)
  const goalTitleOf = useGoalTitle()
  if (!model) return null

  const today = model.built.today
  const monday = startOfWeek(today)
  const week = (from: string) =>
    blocks
      .filter(
        (b) =>
          b.origin === 'ai' &&
          b.on_date >= from &&
          b.on_date <= addDays(from, 6) &&
          b.status !== 'skipped',
      )
      .reduce((s, b) => s + b.planned_minutes, 0)
  const thisWeek = week(monday)
  const lastWeek = week(addDays(monday, -7))
  const goals = model.built.state.goals.filter((g) => g.kind === 'exam').slice(0, 3)
  const deficits = new Map(model.result.deficits.map((d) => [d.goalId, d]))
  // The shortfall shown in the list comes first, then any other (a deadline).
  const firstDeficit =
    model.result.deficits.find((d) => goals.some((g) => g.id === d.goalId)) ??
    model.result.deficits[0]
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? ''
  const goalTitle = (id: string) => goalTitleOf(id) ?? ''
  const date = (d: string) => format(toDisplayDate(d), 'd. MMM', { locale: dateFnsLocales[locale] })

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-ink-secondary first-letter:uppercase">
          {format(toDisplayDate(today), 'EEEE, d. MMMM', { locale: dateFnsLocales[locale] })}
        </span>
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.6px]">
          {t('fresh.title')}
        </h1>
        <p className="text-[15px] leading-[1.4] text-ink-secondary">{t('fresh.body')}</p>
      </div>

      <section className="glass-tint flex flex-col gap-1 rounded-card p-4">
        <span className="text-xs font-bold tracking-[1px] text-white/75 uppercase">
          {t('fresh.thisWeek')}
        </span>
        <span className="text-[26px] font-bold">{formatDuration(t, thisWeek)}</span>
        <span className="text-sm leading-[1.4] text-white/85">
          {lastWeek > thisWeek
            ? t('fresh.lessThanBefore', { time: formatDuration(t, lastWeek) })
            : t('fresh.grows')}
        </span>
      </section>

      {goals.length > 0 && (
        <section className="glass flex flex-col gap-2.5 rounded-card p-4">
          <span className="text-[15px] font-semibold">{t('fresh.untilExams')}</span>
          {goals.map((g) => {
            const d = deficits.get(g.id)
            return (
              <div key={g.id} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {goalTitle(g.id)} · {subjectName(g.subjectId)} · {date(g.on)}
                </span>
                <span
                  className={
                    d ? 'font-semibold text-warning-ink' : 'font-semibold text-success-ink'
                  }
                >
                  {d
                    ? t('fresh.short', { time: formatDuration(t, d.minutes) })
                    : t('fresh.onTrack')}
                </span>
              </div>
            )
          })}
          {firstDeficit && (
            <span className="text-xs text-ink-muted">
              {t('fresh.choose', { subject: subjectName(firstDeficit.subjectId) })}
            </span>
          )}
        </section>
      )}

      <div className="mt-1 flex flex-col gap-1.5">
        <Link
          to="/"
          className="btn-primary flex h-[52px] items-center justify-center rounded-full text-[15px] font-semibold"
        >
          {t('fresh.showToday')}
        </Link>
        {firstDeficit && (
          <button
            type="button"
            onClick={() => setSolve(true)}
            className="glass flex h-12 items-center justify-center rounded-full text-[15px] font-semibold text-brand"
          >
            {t('fresh.solve', { subject: subjectName(firstDeficit.subjectId) })}
          </button>
        )}
      </div>
      <ReplanSheet open={solve} onOpenChange={setSolve} goalId={firstDeficit?.goalId} />
    </div>
  )
}

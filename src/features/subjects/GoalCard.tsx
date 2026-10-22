import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { usePatchSubject } from '@/features/plan/actions'
import { usePlanStore } from '@/features/plan/store'
import { useLocale } from '@/features/settings/useLocale'
import { toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { coverageOf, priorityRule } from '@/lib/scheduler'
import { asPriority, type SubjectWithAssessments } from './model'

/**
 * "Cilj" on Predmet (PRD "Prioritet i režim učenja" → Šta korisnik vidi): how important the
 * subject is (a name, no number), the target grade and when studying starts; the boost as a chip
 * with ×; one line to align a high target with "Važan"; the consequences in small print.
 */
export function GoalCard({ subject, today }: { subject: SubjectWithAssessments; today: string }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const patch = usePatchSubject()
  const model = usePlanStore((s) => s.model)
  const planSubject = model?.built.state.subjects.find((s) => s.id === subject.id)
  const unreachable = model?.built.targetGrade.includes(subject.id) ?? false
  const start = model?.result.campaignStarts[subject.id] ?? subject.campaign_start_on
  const date = (d: string) => format(toDisplayDate(d), 'd. MMM', { locale: dateFnsLocales[locale] })
  const level = (p: number) => t(`subjects.priority.${asPriority(p)}.name`)
  const boosted = subject.priority_boost_until !== null && subject.priority_boost_until >= today
  const nudge = subject.target_grade !== null && subject.target_grade >= 9 && subject.priority < 4
  const coverage = Math.round(
    (planSubject ? coverageOf(planSubject) : priorityRule(subject.priority).coverage) * 100,
  )
  const retention = priorityRule(subject.priority).retention
  const often = retention >= 0.9 ? 'high' : retention >= 0.85 ? 'mid' : 'low'

  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[15px]">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )

  return (
    <section className="glass flex flex-col gap-1 rounded-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold">{t('subjects.goal.title')}</span>
        <Link
          to={`/subjects/${subject.id}/edit?goal=1`}
          className="py-2.5 text-[13px] font-medium text-brand"
        >
          {t('subjects.goal.edit')} ›
        </Link>
      </div>
      {row(t('subjects.goal.importantRow'), level(subject.priority))}
      {row(
        t('subjects.goal.targetRow'),
        subject.target_grade === null ? t('subjects.goal.noTarget') : String(subject.target_grade),
      )}
      {row(
        t('subjects.goal.whenRow'),
        subject.study_mode === 'campaign'
          ? start
            ? t('subjects.goal.campaignFrom', { date: date(start) })
            : t('subjects.goal.campaignLater')
          : t('subjects.goal.fromToday'),
      )}
      {boosted && (
        <span className="mt-1.5 flex h-9 items-center gap-1 self-start rounded-full bg-brand-soft pr-1 pl-3 text-[13px] font-semibold text-brand">
          {t('subjects.goal.boostSimple', { date: date(subject.priority_boost_until!) })}
          <button
            type="button"
            aria-label={t('subjects.goal.endBoost')}
            onClick={() => patch.mutate({ id: subject.id, patch: { priority_boost_until: null } })}
            className="flex size-9 items-center justify-center rounded-full text-base"
          >
            ×
          </button>
        </span>
      )}
      {(nudge || unreachable) && (
        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-[16px] bg-warning-soft py-1.5 pr-1.5 pl-3.5">
          <span className="text-[13px] text-warning-ink">
            {nudge
              ? t('subjects.goal.nudge', { grade: subject.target_grade, level: level(4) })
              : t('subjects.goal.unreachable')}
          </span>
          {subject.priority < 4 && (
            <button
              type="button"
              onClick={() => patch.mutate({ id: subject.id, patch: { priority: 4 } })}
              className="flex min-h-10 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold text-brand"
            >
              {t('subjects.goal.change')}
            </button>
          )}
        </div>
      )}
      <span className="mt-1 text-xs text-ink-muted">
        {t('subjects.goal.effect', { coverage, often: t(`subjects.goal.often.${often}`) })}
      </span>
    </section>
  )
}

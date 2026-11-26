import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { usePatchSubject } from '@/features/plan/actions'
import { usePlanStore } from '@/features/plan/store'
import { useLocale } from '@/features/settings/useLocale'
import { toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { coverageOf, isConditional, priorityRule } from '@/lib/scheduler'
import type { SubjectWithAssessments } from './model'

/**
 * "Cilj" on Predmet (PRD "Dopune, 5. nov 2026"): "Uslovni predmet" when it is, the target grade
 * and when studying starts; the boost as a chip with ×; the consequences in small print. The
 * priority comes from the goal (`priorityFromGoal()`), so there is no alignment line any more.
 */
export function GoalCard({ subject, today }: { subject: SubjectWithAssessments; today: string }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const patch = usePatchSubject()
  const model = usePlanStore((s) => s.model)
  const planSubject = model?.built.state.subjects.find((s) => s.id === subject.id)
  const start = model?.result.campaignStarts[subject.id] ?? subject.campaign_start_on
  const date = (d: string) => format(toDisplayDate(d), 'd. MMM', { locale: dateFnsLocales[locale] })
  const boosted = subject.priority_boost_until !== null && subject.priority_boost_until >= today
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
    <section className="surface flex flex-col gap-1 rounded-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold">{t('subjects.goal.title')}</span>
        <Link
          to={`/subjects/${subject.id}/edit?goal=1`}
          className="py-2.5 text-[13px] font-medium text-brand"
        >
          {t('subjects.goal.edit')} ›
        </Link>
      </div>
      {isConditional(subject.priority) && (
        <span className="mt-0.5 flex h-7 items-center self-start rounded-full bg-brand-soft px-3 text-[13px] font-bold text-brand-strong">
          {t('subjects.form.conditional')}
        </span>
      )}
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
      <span className="mt-1 text-xs text-ink-muted">
        {t('subjects.goal.effect', { coverage, often: t(`subjects.goal.often.${often}`) })}
      </span>
    </section>
  )
}

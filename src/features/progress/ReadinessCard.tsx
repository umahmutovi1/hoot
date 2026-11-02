import { usePlanStore } from '@/features/plan/store'
import { useTranslation } from 'react-i18next'
import { useSubjects, useSaveExamResult } from '@/features/subjects/api'
import { useDayBoundary } from '@/features/settings/profile'
import { useState } from 'react'
import { addDays, localDay } from '@/lib/day'
import { examDate } from '@/features/plan/state'
import { overestimation } from '@/lib/progress/readiness'

export function ReadinessCard() {
  const { t } = useTranslation()
  const { data: subjects = [] } = useSubjects()
  const boundary = useDayBoundary()
  const [now] = useState(() => new Date())
  const modelDay = usePlanStore((s) => s.model?.built.today)
  const tomorrow = addDays(modelDay ?? localDay(now, boundary), 1)
  const save = useSaveExamResult()
  const active = subjects.filter((s) => !s.archived)
  const signal = overestimation(active.flatMap((s) => s.assessments))
  const exams = active.flatMap((s) =>
    s.assessments
      .filter(
        (a) =>
          !a.archived_at &&
          !a.passed &&
          a.result_points === null &&
          examDate(a, boundary) === tomorrow,
      )
      .map((exam) => ({ exam, subject: s })),
  )
  if (!exams.length && !signal) return null
  return (
    <section className="glass flex flex-col gap-3 rounded-card p-4">
      <h2 className="text-base font-semibold">{t('progress.readiness.title')}</h2>
      {signal && (
        <p className="text-sm text-ink-secondary">{t('progress.readiness.calibration', signal)}</p>
      )}
      {exams.map(({ exam, subject }) => (
        <div key={exam.id} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">
            {subject.name} · {exam.title}
          </h3>
          <p className="text-xs text-ink-muted">{t('progress.readiness.question')}</p>
          <div
            className="grid grid-cols-5 gap-1"
            role="group"
            aria-label={t('progress.readiness.question')}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                disabled={save.isPending}
                aria-pressed={exam.readiness_before === n}
                onClick={() => save.mutate({ id: exam.id, patch: { readiness_before: n } })}
                className={`min-h-11 rounded-full text-sm ${exam.readiness_before === n ? 'bg-brand text-white' : 'bg-white/40'}`}
              >
                {n * 20}%
              </button>
            ))}
          </div>
          {exam.readiness_before !== null && (
            <p role="status" className="text-xs text-brand">
              {t('progress.readiness.saved')}
            </p>
          )}
        </div>
      ))}
    </section>
  )
}

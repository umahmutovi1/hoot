import { acceptedThisWeek } from './feedbackInputs'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProgress } from '@/features/progress/useProgress'
import { usePlanStore } from '@/features/plan/store'
import { useInsightData } from './useInsights'
import { actionLabel, insightCopy, techniqueLinks } from './copy'
import { useApplyAction } from './useApplyAction'
import { activeDecision, useRecordFeedback } from './feedback'

export function InsightsPanel({ review = false }: { review?: boolean }) {
  const { t } = useTranslation()
  const data = useProgress()
  const insight = useInsightData()
  const apply = useApplyAction(),
    record = useRecordFeedback()
  const replan = usePlanStore((s) => s.replanNow)
  if (!data) return null
  return (
    <section className="surface flex flex-col gap-3 rounded-card p-4">
      <h2 className="text-base font-semibold">{t('insights.title')}</h2>
      {!insight ? (
        <p className="text-sm text-ink-muted">{t('insights.loading')}</p>
      ) : !insight.list.length ? (
        <p className="text-sm text-ink-muted">{t('insights.empty')}</p>
      ) : (
        insight.list.slice(0, 3).map((i) => {
          const subject =
            'subjectId' in i
              ? (data.inputs.subjects.find((s) => s.id === i.subjectId)?.name ?? '')
              : ''
          const accepted = activeDecision(insight.feedback, i.id, data.today)?.status === 'accepted'
          return (
            <article key={i.id} className="flex flex-col gap-2 rounded-[18px] bg-white/40 p-3.5">
              <h3 className="text-sm font-semibold">{t(`insights.kinds.${i.kind}`)}</h3>
              <p className="text-sm text-ink-secondary">{insightCopy(t, i, subject)}</p>
              {i.action && (
                <button
                  type="button"
                  disabled={
                    apply.isPending ||
                    record.isPending ||
                    accepted ||
                    acceptedThisWeek(insight.feedback, insight.window.nextFrom) >= 3
                  }
                  className="btn-primary min-h-11 rounded-full px-3 text-sm"
                  onClick={() =>
                    void (async () => {
                      await apply.mutateAsync(i.action!)
                      await record.mutateAsync({
                        insightId: i.id,
                        status: 'accepted',
                        payload: { action: i.action, week: insight.window.nextFrom },
                      })
                      replan()
                    })().catch(() => {})
                  }
                >
                  {accepted ? t('strategist.applied') : actionLabel(t, i.action, subject)}
                </button>
              )}
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  className="min-h-11 text-xs text-ink-muted"
                  disabled={record.isPending}
                  onClick={() =>
                    record.mutate({
                      insightId: i.id,
                      status: 'not_useful',
                      payload: { action: i.action, week: insight.window.nextFrom },
                    })
                  }
                >
                  {t('insights.notUseful')}
                </button>
                {i.action && (
                  <button
                    type="button"
                    className="min-h-11 text-xs text-brand"
                    disabled={record.isPending}
                    onClick={() =>
                      record.mutate(
                        {
                          insightId: i.id,
                          status: 'rejected',
                          payload: { action: i.action, week: insight.window.nextFrom },
                        },
                        { onSuccess: replan },
                      )
                    }
                  >
                    {t(accepted ? 'strategist.cancel' : 'progress.rhythm.later')}
                  </button>
                )}
              </div>
              {i.technique && (
                <a
                  href={techniqueLinks[i.technique]}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center text-xs text-brand"
                >
                  {t(`insights.techniques.${i.technique}`)}
                </a>
              )}
            </article>
          )
        })
      )}
      {insight?.historyError && (
        <button
          type="button"
          className="min-h-11 text-xs text-brand"
          onClick={() => void insight.retry()}
        >
          {t('progress.statistics.retry')}
        </button>
      )}
      {!review && (
        <Link
          to="/progress/week"
          className="flex min-h-11 items-center justify-center rounded-full bg-white/40 text-sm font-semibold text-brand"
        >
          {t('checkin.title')}
        </Link>
      )}
    </section>
  )
}

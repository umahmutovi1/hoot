import { useTranslation } from 'react-i18next'
import { useProgress } from '@/features/progress/useProgress'
import { usePlanStore } from '@/features/plan/store'
import { useFeedback, useRecordFeedback } from './feedback'
import { activeDecisions, feedbackAction } from './feedbackInputs'

/** Persistent input controls stay available even when the insight no longer meets its threshold. */
export function ActiveInputs() {
  const { t } = useTranslation()
  const data = useProgress()
  const feedback = useFeedback().data ?? []
  const record = useRecordFeedback()
  const replan = usePlanStore((s) => s.replanNow)
  const rows = activeDecisions(feedback).filter(
    (r) =>
      feedbackAction(r)?.kind === 'strict_recall_gate' ||
      (feedbackAction(r)?.kind === 'questions_next' &&
        data?.model.built.state.questionsNext?.id === r.id),
  )
  if (!data || !rows.length) return null
  return (
    <section className="surface flex flex-col gap-3 rounded-card p-4">
      <h2 className="text-base font-semibold">{t('strategist.active')}</h2>
      {rows.map((row) => {
        const action = feedbackAction(row)!
        const subject = data.inputs.subjects.find((s) => s.id === action.subjectId)?.name ?? ''
        return (
          <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              {action.kind === 'strict_recall_gate'
                ? t('strategist.actions.strict_recall_gate', { subject })
                : t('strategist.actions.questions_next', {
                    blocks: data.model.built.state.questionsNext?.remaining ?? 0,
                  })}
            </span>
            <button
              type="button"
              className="min-h-11 shrink-0 text-xs text-brand"
              disabled={record.isPending}
              onClick={() =>
                record.mutate(
                  {
                    insightId: row.insight_id ?? undefined,
                    candidateId: row.candidate_id ?? undefined,
                    status: 'rejected',
                    payload: { action },
                  },
                  { onSuccess: replan },
                )
              }
            >
              {t('strategist.cancel')}
            </button>
          </div>
        )
      })}
    </section>
  )
}

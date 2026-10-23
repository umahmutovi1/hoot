import { useTranslation } from 'react-i18next'
import { LazyMarkdown } from '@/components/LazyMarkdown'
import { SparkleIcon } from '@/components/icons'
import { AiCallError, useAiAvailability } from '@/features/owl/api'
import { useProposeAnswer } from './recallApi'

/**
 * "Predloži odgovor" for an exam question without an answer (propose-answer): the suggestion is
 * shown marked "provjeri" and saved only when the user accepts it (answer_origin = 'ai').
 */
export function ProposeAnswer({
  questionId,
  onAccept,
}: {
  questionId: string
  onAccept: (answer: string) => void
}) {
  const { t } = useTranslation()
  const { state } = useAiAvailability()
  const propose = useProposeAnswer()
  if (state !== 'ready') return null
  const error = propose.error
    ? propose.error instanceof AiCallError
      ? propose.error.code
      : 'failed'
    : null
  if (!propose.data)
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled={propose.isPending}
          onClick={() => propose.mutate(questionId)}
          className="flex h-11 items-center gap-1.5 self-start rounded-full glass px-4 text-sm font-semibold text-brand disabled:opacity-50"
        >
          <SparkleIcon size={16} />
          {propose.isPending ? t('recall.proposing') : t('recall.propose')}
        </button>
        {error && (
          <span role="alert" className="text-sm text-danger">
            {t(`owl.error.${error as 'failed'}`)}
          </span>
        )}
      </div>
    )
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] bg-warning-soft p-4">
      <span className="text-xs font-semibold text-warning-muted">{t('recall.proposedLabel')}</span>
      <div className="text-[15px] leading-[1.4]">
        <LazyMarkdown>{propose.data}</LazyMarkdown>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAccept(propose.data!)}
          className="h-11 rounded-full bg-white/70 px-4 text-sm font-semibold text-brand"
        >
          {t('recall.saveAnswer')}
        </button>
        <button
          type="button"
          onClick={() => propose.reset()}
          className="h-11 px-2 text-sm font-medium text-ink-muted"
        >
          {t('recall.discardProposal')}
        </button>
      </div>
    </div>
  )
}

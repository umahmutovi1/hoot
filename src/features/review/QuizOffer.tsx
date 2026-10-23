import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QUIZ_QUESTIONS } from '@shared/schemas.ts'
import { SparkleIcon } from '@/components/icons'
import { useAiAvailability } from '@/features/owl/api'
import { cn } from '@/lib/utils'

/**
 * Kviz (PRD: recall-questions with 5–10 questions, from Jedinica or from a session): AI questions
 * from the notes (or general knowledge), rated like the recall gate. Hidden without AI.
 */
export function QuizOffer({
  unitIds,
  to,
  className,
}: {
  unitIds: string[]
  /** Where the quiz returns. */
  to: string
  className?: string
}) {
  const { t } = useTranslation()
  const { state } = useAiAvailability()
  if (state !== 'ready' || unitIds.length === 0) return null
  return (
    <Link
      to={`/session/recall?units=${unitIds.join(',')}&quiz=1&to=${encodeURIComponent(to)}`}
      className={cn(
        'flex h-12 items-center justify-center gap-2 rounded-full border-2 border-brand glass text-[15px] font-semibold text-brand',
        className,
      )}
    >
      <SparkleIcon size={18} />
      {t('recall.quizOffer', { count: QUIZ_QUESTIONS })}
    </Link>
  )
}

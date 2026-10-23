import { useAllSources } from '@/features/plan/api'
import { QuizOffer } from './QuizOffer'

/** In a session: a quiz on the chapter being read; the timer keeps running, the quiz returns. */
export function SessionQuizOffer({ unitId }: { unitId: string }) {
  const { data: sources } = useAllSources()
  const unit = sources?.flatMap((s) => s.units).find((u) => u.id === unitId)
  if (!unit || unit.kind !== 'chapter') return null
  return <QuizOffer unitIds={[unit.id]} to="/session" />
}

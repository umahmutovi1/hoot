import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAllSources, useQuestionLinks, useTopicLinks } from '@/features/plan/api'
import { linkedQuestions } from './gate'

/**
 * In a session: the exam questions linked (by topic) to the chapter being read, offered right
 * away as a recall gate (PRD "Izvor Pitanja"). The timer keeps running; the gate comes back here.
 */
export function LinkedQuestionsOffer({ unitId }: { unitId: string }) {
  const { t } = useTranslation()
  const { data: sources } = useAllSources()
  const { data: links } = useTopicLinks()
  const { data: direct } = useQuestionLinks()
  const source = sources?.find((s) => s.units.some((u) => u.id === unitId))
  const unit = source?.units.find((u) => u.id === unitId)
  if (!sources || !links || !source || !unit || unit.kind !== 'chapter') return null
  const subjectUnits = sources
    .filter((s) => s.subject_id === source.subject_id)
    .flatMap((s) => s.units)
  const count = linkedQuestions(
    { key: unit.id, title: unit.title, label: unit.label, leaves: [unit] },
    links,
    subjectUnits,
    direct,
  ).length
  if (count === 0) return null
  return (
    <div className="flex items-center justify-between gap-3 rounded-[24px] glass px-4 py-3">
      <span className="text-sm text-ink-secondary">{t('recall.offerQuestions', { count })}</span>
      <Link
        to={`/session/recall?units=${unit.id}&to=${encodeURIComponent('/session')}`}
        className="flex h-11 shrink-0 items-center rounded-full btn-primary px-4 text-sm font-semibold"
      >
        {t('recall.title')}
      </Link>
    </div>
  )
}

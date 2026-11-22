import { useMemo } from 'react'
import { useAllSources, useQuestionLinks, useTopicLinks } from '@/features/plan/api'
import { useCardsOf } from '@/features/review/api'
import type { CheckItem } from '@/features/review/check'
import { linkedQuestions } from '@/features/review/gate'
import { useDayBoundary } from '@/features/settings/profile'
import { useNow } from '@/features/session/useNow'
import type { Unit } from '@/features/sources/model'
import { localDay } from '@/lib/day'
import { roundItems } from './round'
import type { TutorContext } from './context'

/** Exam questions linked to the chapter (same as the recall gate) and the round built from them. */
export function useRound(ctx: TutorContext): {
  questions: Unit[]
  items: CheckItem[] | null
} {
  const { data: sources } = useAllSources()
  const { data: links } = useTopicLinks()
  const { data: direct } = useQuestionLinks()
  const leafIds = ctx.leaves.map((l) => l.id)
  const { data: cards } = useCardsOf(leafIds)
  const boundary = useDayBoundary()
  const now = useNow(60_000)
  const today = localDay(now, boundary)
  return useMemo(() => {
    if (!sources || !links || !direct) return { questions: [], items: null }
    const subjectUnits = sources
      .filter((s) => s.subject_id === ctx.subjectId)
      .flatMap((s) => s.units)
    const questions = linkedQuestions(
      { key: ctx.unit.id, title: ctx.unit.title, label: ctx.unit.label, leaves: ctx.leaves },
      links,
      subjectUnits,
      direct,
    )
    return {
      questions,
      items: cards ? roundItems(ctx.leaves, questions, cards, today) : null,
    }
  }, [sources, links, direct, cards, ctx.subjectId, ctx.unit, ctx.leaves, today])
}

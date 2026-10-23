import { subtreeLeaves } from '@/lib/progress'
import type { ScopeChoice } from '@/lib/progress/scope'
import { suggestScope } from '@/lib/progress/scopeSuggest'
import {
  chaptersByQuestion,
  questionsByChapter,
  type DirectLink,
  type TopicLink,
} from '@/lib/questions/links'
import { asProgress, partialExams, type AssessmentUnit, type SourceMaterial } from './model'
import type { Assessment } from '@/features/subjects/model'

/** The ObimIspita suggestion for a subject's top-level units that have no scope rows yet. */
export function scopeSuggestion(
  materials: SourceMaterial[],
  exams: Assessment[],
  stored: AssessmentUnit[],
  topicLinks: TopicLink[],
  directLinks: DirectLink[],
): Map<string, ScopeChoice> {
  const all = materials.flatMap((m) => m.units)
  const parentOf = new Map(all.map((u) => [u.id, u.parent_id]))
  const topOf = (id: string): string => {
    let at = id
    for (let p = parentOf.get(at); p; p = parentOf.get(at)) at = p
    return at
  }
  const byQuestion = chaptersByQuestion(
    questionsByChapter(
      all.map((u) => ({ id: u.id, kind: u.kind })),
      topicLinks,
      directLinks,
    ),
  )
  const chaptersOf = new Map(
    [...byQuestion].map(([q, chapters]) => [q, new Set([...chapters].map(topOf))]),
  )
  return suggestScope({
    partialIds: partialExams(exams).map((e) => e.id),
    hasWholeExam: exams.some((e) => e.scope_all),
    sources: materials
      .filter((m) => !m.source.is_rough)
      .map((m) => {
        const progress = asProgress(m.units)
        return {
          kind: m.source.kind === 'questions' ? ('questions' as const) : ('chapters' as const),
          units: m.units
            .filter((u) => u.parent_id === null)
            .map((u) => ({
              id: u.id,
              minutes: subtreeLeaves(progress, u.id).reduce((s, l) => s + l.minutes, 0),
            })),
        }
      }),
    chaptersOf,
    assigned: new Set(stored.map((r) => r.unit_id)),
  })
}

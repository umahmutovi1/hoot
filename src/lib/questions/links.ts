/**
 * Exam question ↔ chapter (PRD "Izvor Pitanja", odluka Etapa 10): a question belongs to a chapter
 * through a shared topic or a direct link (`question_links`). A direct link with `linked = false`
 * is the user saying "not this chapter" and wins over a shared topic.
 */

export interface TopicLink {
  unit_id: string
  topic_id: string
}

export interface DirectLink {
  question_id: string
  unit_id: string
  linked: boolean
}

export interface LinkUnit {
  id: string
  kind: 'chapter' | 'question'
}

/** Chapter id → ids of the questions linked to it. */
export function questionsByChapter(
  units: LinkUnit[],
  topicLinks: TopicLink[],
  directLinks: DirectLink[],
): Map<string, Set<string>> {
  const kind = new Map(units.map((u) => [u.id, u.kind]))
  const byTopic = new Map<string, string[]>()
  for (const l of topicLinks)
    if (kind.has(l.unit_id))
      byTopic.set(l.topic_id, [...(byTopic.get(l.topic_id) ?? []), l.unit_id])

  const out = new Map<string, Set<string>>()
  const add = (chapter: string, question: string) =>
    out.set(chapter, (out.get(chapter) ?? new Set()).add(question))
  for (const members of byTopic.values()) {
    const questions = members.filter((id) => kind.get(id) === 'question')
    for (const c of members) if (kind.get(c) === 'chapter') for (const q of questions) add(c, q)
  }
  for (const l of directLinks) {
    if (kind.get(l.question_id) !== 'question' || kind.get(l.unit_id) !== 'chapter') continue
    if (l.linked) add(l.unit_id, l.question_id)
  }
  for (const l of directLinks) if (!l.linked) out.get(l.unit_id)?.delete(l.question_id)
  return out
}

/** Question id → ids of its chapters (the same relation, the other way round). */
export function chaptersByQuestion(byChapter: Map<string, Set<string>>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const [chapter, questions] of byChapter)
    for (const q of questions) out.set(q, (out.get(q) ?? new Set()).add(chapter))
  return out
}

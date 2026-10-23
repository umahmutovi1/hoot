// Prompt builders and output normalization for the content import (parse-toc, parse-questions,
// link-questions). Pure, so they are unit-tested and used by the promptfoo evals as sent.
import type { LlmFile, LlmRequest } from './llm.ts'
import { linkOutputSchema, questionsParseSchema, tocParseSchema } from './schemas.ts'
import type {
  LinkOutput,
  ParseQuestionsRequest,
  ParseTocRequest,
  QuestionsParse,
  TocParse,
} from './schemas.ts'

const LANGUAGE = { bs: 'Bosnian', en: 'English' } as const

const KIND_NAME = {
  book: 'textbook',
  script: 'lecture script',
  slides: 'lecture slides',
  other: 'study material',
} as const

const TOPIC_RULES = `Topics: give each unit 1-3 short topics (a few words, the concept it teaches),
in the language of the material. A topic is a specific concept ("Konvolucija", "Parsevalova
teorema"), never the subject's name or a broad area that would fit most units. Topics connect
chapters with exam questions, so the same concept must get the same topic name everywhere. When an existing topic fits, copy its name exactly;
create a new topic only for a concept none of them covers.`

function topicLines(topics: string[]): string[] {
  return topics.length > 0
    ? ['Existing topics of this subject:', ...topics.map((t) => `- ${t}`)]
    : ['Existing topics of this subject: (none yet)']
}

export function tocRequest(req: ParseTocRequest, files: LlmFile[]): LlmRequest<TocParse> {
  const estimate = (req.units?.length ?? 0) > 0
  const unitWord = req.measure === 'slides' ? 'slide' : 'page'
  const system = estimate
    ? `You rate the units of a student's ${KIND_NAME[req.source_kind]} for Hoot, a study planner.
The units are given; return every one of them with the same label and title, in the same order.
- ai_difficulty 1-5: how hard the unit is to learn compared with the other units of this subject
  (3 = average). Judge from the title, the subject and the neighbouring units.
- page_start and page_end are null.
${TOPIC_RULES}
Write "warnings" in the user's language; usually there are none.`
    : `You read the table of contents of a student's ${KIND_NAME[req.source_kind]} for Hoot, a study
planner. Return the units exactly as listed, in order. Never invent units or ${unitWord}s.
- label: the number as printed ("4", "4.1", "4.1.2"); sub-units use dotted numbers under their
  parent. At most three levels: list deeper entries under their third-level parent's label.
  Without printed numbers, number the top-level units "1", "2", … and sub-units "1.1", "1.2".
- title: as written, without the leader dots and the ${unitWord} number.
- page_start: the ${unitWord} number printed next to the unit; null when there is none.
- page_end: only when the range is printed ("284-355"), else null. Never compute it.
- ai_difficulty 1-5: how hard the unit is to learn compared with the other units of this subject
  (3 = average), judged from the title, the subject and the neighbouring units.
- Skip front and back matter without study content (preface, index, bibliography, answers).
${TOPIC_RULES}
Anything unreadable or uncertain goes into "warnings", in the user's language, naming the label.`

  const lines = [
    `Subject: ${req.subject}`,
    `Material: ${req.title || KIND_NAME[req.source_kind]}`,
    `User language: ${LANGUAGE[req.locale]}`,
    ...topicLines(req.topics),
  ]
  if (estimate) {
    lines.push('Units (label: title):', ...req.units!.map((u) => `${u.label}: ${u.title}`))
  } else if (req.text?.trim()) {
    lines.push('Table of contents:', req.text)
  } else {
    lines.push(`The table of contents is in the attached ${files.length > 1 ? 'files' : 'file'}.`)
  }
  return {
    task: 'parse_toc',
    system,
    text: lines.join('\n'),
    files,
    schema: tocParseSchema,
    maxTokens: 8000,
  }
}

export function questionsRequest(
  req: ParseQuestionsRequest,
  files: LlmFile[],
): LlmRequest<QuestionsParse> {
  const system = `You read a list of exam questions for Hoot, a study planner for one student.
Return every question exactly as written, in order. Never invent, merge or rephrase questions.
- label: "P" + the printed number ("8." -> "P8"); without numbers "P1", "P2", … by position.
- title: the full question text without its number; a question that continues on the next line stays one question.
- Sub-items (a, b, c) belong to their question's text.
Topics: give each question 1-3 short topics (the specific concepts it asks about, never the
subject's name or a broad area), in the language of the questions. Topics connect questions with textbook chapters, so the same concept must get the same
name everywhere. When an existing topic fits, copy its name exactly; create a new topic only for a
concept none of them covers.
Anything unreadable goes into "warnings", in the user's language, naming the label.`
  const lines = [
    `Subject: ${req.subject}`,
    `User language: ${LANGUAGE[req.locale]}`,
    ...topicLines(req.topics),
  ]
  if (req.text?.trim()) lines.push('Questions:', req.text)
  else lines.push(`The questions are in the attached ${files.length > 1 ? 'files' : 'file'}.`)
  return {
    task: 'parse_questions',
    system,
    text: lines.join('\n'),
    files,
    schema: questionsParseSchema,
    maxTokens: 12000,
  }
}

export interface LinkPromptQuestion {
  id: string
  text: string
  /** Candidate chapters from embeddings, nearest first. */
  candidates: { id: string; label: string | null; title: string; similarity: number }[]
}

/**
 * Each question with its numbered candidate chapters; the model picks 0–2 of them. Numbers are
 * per prompt, so the output can only name chapters it was offered.
 */
export function linkRequest(
  subject: string,
  locale: 'bs' | 'en',
  questions: LinkPromptQuestion[],
): { request: LlmRequest<LinkOutput>; chapters: string[] } {
  const chapters: string[] = []
  const numberOf = new Map<string, number>()
  const lines = [`Subject: ${subject}`, 'Chapters:']
  for (const q of questions)
    for (const c of q.candidates)
      if (!numberOf.has(c.id)) {
        chapters.push(c.id)
        numberOf.set(c.id, chapters.length)
        lines.push(`${chapters.length}. ${[c.label, c.title].filter(Boolean).join(' ')}`)
      }
  lines.push('Questions (number: text → candidate chapters):')
  questions.forEach((q, i) => {
    const offered = q.candidates.map((c) => numberOf.get(c.id)).join(', ')
    lines.push(`${i + 1}: ${q.text} → ${offered}`)
  })
  return {
    chapters,
    request: {
      task: 'link_questions',
      system: `You link exam questions to the textbook chapters that teach what they ask, for Hoot,
a study planner (${LANGUAGE[locale]}). For every question pick 0-2 chapters, only from its own
candidates: the chapter(s) a student must study to answer it. Pick none when no candidate teaches
it. Return one entry per question number.`,
      text: lines.join('\n'),
      schema: linkOutputSchema,
      maxTokens: 4000,
    },
  }
}

/** Picks that were offered to that question, at most two per question. */
export function normalizeLinks(
  output: LinkOutput,
  questions: LinkPromptQuestion[],
  chapters: string[],
) {
  const out: { question_id: string; unit_id: string; similarity: number }[] = []
  for (const link of output.links) {
    const q = questions[link.question - 1]
    if (!q) continue
    const seen = new Set<string>()
    for (const n of link.chapters) {
      const id = chapters[n - 1]
      const candidate = q.candidates.find((c) => c.id === id)
      if (!candidate || seen.has(candidate.id) || seen.size >= 2) continue
      seen.add(candidate.id)
      out.push({ question_id: q.id, unit_id: candidate.id, similarity: candidate.similarity })
    }
  }
  return out
}

/** Exact spelling of an existing topic when only case or spacing differs; max 3, no repeats. */
export function normalizeTopics(names: string[], existing: string[]): string[] {
  const byKey = new Map(existing.map((t) => [topicKey(t), t]))
  const out: string[] = []
  for (const raw of names) {
    const name = raw.replace(/\s+/g, ' ').trim()
    if (!name) continue
    const canonical = byKey.get(topicKey(name)) ?? name
    if (!out.some((t) => topicKey(t) === topicKey(canonical))) out.push(canonical)
    if (out.length === 3) break
  }
  return out
}

export function topicKey(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

/** Unique labels, sane page ranges, topics in the subject's spelling. */
export function normalizeToc(req: ParseTocRequest, data: TocParse): TocParse {
  const seen = new Set<string>()
  const units = data.units.flatMap((u) => {
    const label = u.label.trim().replace(/\.$/, '')
    const title = u.title.trim()
    if (!label || !title || seen.has(label)) return []
    seen.add(label)
    const page_end =
      u.page_start !== null && u.page_end !== null && u.page_end < u.page_start ? null : u.page_end
    return [{ ...u, label, title, page_end, topics: normalizeTopics(u.topics, req.topics) }]
  })
  return { units, warnings: data.warnings }
}

export function normalizeQuestions(
  req: ParseQuestionsRequest,
  data: QuestionsParse,
): QuestionsParse {
  const seen = new Set<string>()
  const questions = data.questions.flatMap((q) => {
    let label = q.label.trim().replace(/\.$/, '')
    if (/^\d+$/.test(label)) label = `P${label}`
    // The printed number belongs to the label, not the question text.
    const title = q.title.trim().replace(/^(?:P\s?)?\d+[.):]\s+/i, '')
    if (!label || !title) return []
    let unique = label
    for (let n = 2; seen.has(unique); n++) unique = `${label}-${n}`
    seen.add(unique)
    return [{ label: unique, title, topics: normalizeTopics(q.topics, req.topics) }]
  })
  return { questions, warnings: data.warnings }
}

// Prompts for AI recall questions and proposed answers (PRD "Testiranje bez sadržaja
// literature"). The app has no book text: questions come from the student's notes, a photo of a
// page, or general knowledge from the chapter title (always flagged as possibly different from
// the lectures). Pure, so it is unit-tested.
import type { LlmFile, LlmRequest } from './llm.ts'
import { proposeAnswerOutputSchema, recallOutputSchema } from './schemas.ts'
import type { ProposeAnswerOutput, RecallAiSource, RecallOutput } from './schemas.ts'

const LANGUAGE = { bs: 'Bosnian', en: 'English' } as const

/** Notes and answers are capped: enough for a few questions, small on the free tier. */
export const MAX_NOTES_CHARS = 6000

export interface RecallMaterial {
  subject: string
  title: string
  label: string | null
  /** Sub-unit titles (from the photographed contents). */
  subheadings: string[]
  notes: string | null
}

const SOURCE_RULES: Record<RecallAiSource, string> = {
  notes: `Use ONLY the student's NOTES below. Every question and answer must come straight from
them; never add facts that are not in the notes. If the notes are too short for the requested
number, return fewer questions.`,
  page_photo: `Use ONLY the attached photo(s) of a textbook page. Every question and answer must
come from what is printed there; never add facts that are not on the page.`,
  general: `There is no material: ask about the core concepts a university course teaches under
this chapter title (and its subheadings), with standard textbook answers. Stay with well-known,
uncontroversial content.`,
}

export function recallRequest(
  material: RecallMaterial,
  source: RecallAiSource,
  count: number,
  locale: 'bs' | 'en',
  files: LlmFile[],
): LlmRequest<RecallOutput> {
  const system = `You write active-recall questions for a student, for Hoot, a study planner.
Write ${count} short questions in ${LANGUAGE[locale]} that test understanding, not trivia: each
asks for one idea, definition, relation or step, answerable in 1-3 sentences. Order them from
basic to deeper. Give the correct answer to each, concise. Plain text; $...$ for formulas.
${SOURCE_RULES[source]}`
  const lines = [
    `Subject: ${material.subject}`,
    `Chapter: ${[material.label, material.title].filter(Boolean).join(' ')}`,
  ]
  if (material.subheadings.length > 0)
    lines.push('Subheadings:', ...material.subheadings.map((h) => `- ${h}`))
  if (source === 'notes') lines.push('NOTES:', (material.notes ?? '').slice(0, MAX_NOTES_CHARS))
  if (source === 'page_photo') lines.push('The page is in the attached photo(s).')
  return {
    task: 'recall_questions',
    system,
    text: lines.join('\n'),
    files,
    schema: recallOutputSchema,
    maxTokens: 2500,
  }
}

/** Drops empty pairs and keeps at most the requested number. */
export function normalizeRecall(output: RecallOutput, count: number) {
  return output.questions
    .map((q) => ({ question: q.question.trim(), answer: q.answer.trim() }))
    .filter((q) => q.question && q.answer)
    .slice(0, count)
}

export interface AnswerMaterial {
  subject: string
  question: string
  /** Chapters the question is linked to, with the student's notes when there are any. */
  chapters: { title: string; notes: string | null }[]
}

export function proposeAnswerRequest(
  material: AnswerMaterial,
  locale: 'bs' | 'en',
): LlmRequest<ProposeAnswerOutput> {
  const lines = [`Subject: ${material.subject}`, `Exam question: ${material.question}`]
  let left = MAX_NOTES_CHARS
  for (const c of material.chapters) {
    lines.push(`Chapter: ${c.title}`)
    if (c.notes && left > 0) {
      const notes = c.notes.slice(0, left)
      left -= notes.length
      lines.push('Notes:', notes)
    }
  }
  return {
    task: 'propose_answer',
    system: `You draft an answer to a university exam question for a student, for Hoot, a study
planner. Answer in ${LANGUAGE[locale]}, the way a good student would answer at the exam: the key
points, definitions and, where it matters, a short example. At most ~150 words; markdown bullet
lists (each item on its own line, starting with "- ") and $...$ for formulas are fine. Prefer what the student's notes say; fill gaps with
standard textbook knowledge. The student will check it against the lectures.`,
    text: lines.join('\n'),
    schema: proposeAnswerOutputSchema,
    maxTokens: 1200,
  }
}

/** Bullets the model ran into one line ("svojstva: * **A:** … * **B:** …") get their own lines. */
export function tidyMarkdown(text: string): string {
  return text
    .replace(/[ \t]+[*•-][ \t]+(?=\*\*)/g, '\n- ')
    .replace(/^[*•][ \t]+/gm, '- ')
    .trim()
}

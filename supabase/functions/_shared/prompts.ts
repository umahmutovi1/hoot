// Prompt builders and output normalization for the AI Edge Functions. Pure, so they are
// unit-tested and checked by the promptfoo evals with the same text the functions send.
import type { z } from 'zod'
import type { AiTask, LlmFile, LlmRequest } from './llm.ts'
import {
  answerOutputSchema,
  autoParseSchema,
  calendarParseSchema,
  documentParseSchema,
  examScheduleParseSchema,
  timetableParseSchema,
} from './schemas.ts'
import type {
  AnswerOutput,
  AnswerRequest,
  ImportKind,
  ParseDocumentRequest,
  ParsedClass,
  ParseResult,
} from './schemas.ts'

const LANGUAGE = { bs: 'Bosnian', en: 'English' } as const

const PARSE_SYSTEM = `You read university documents for Hoot, a study planner for one student.
Extract only what is written. Never invent dates, subjects or rules.
- Dates are YYYY-MM-DD. If a year is missing, use the academic year that contains the given
  today's date (October-September), or the next one if the dates are clearly upcoming.
- Titles and subject names stay exactly as written in the document.
- Anything unclear or unreadable goes into "warnings", written in the user's language.
- "pages": when the document came as an image or PDF file, transcribe its text per page as
  plain text (table rows as "cell | cell"). When the text was already given, return [].`

const CALENDAR_RULES = `Academic calendar -> "periods", one per contiguous date range:
- teaching: a semester's teaching period ("nastava", "zimski/ljetni semestar").
- exam with exam_session "partial": weeks of partial exams / midterms ("parcijalni ispiti",
  "kolokviji"); "regular": a regular exam session ("ispitni rok", e.g. januarsko-februarski);
  "makeup": a makeup / resit session ("popravni rok"). exam_session is null for other kinds.
- holiday: non-working days, holidays and breaks; a single day has starts_on = ends_on.`

const EXAM_RULES = `Exam schedule -> "exams", one per exam that has a date:
- subject_id: the id of the matching subject from the given list (match by meaning:
  abbreviations, missing diacritics, typos). null if none matches; keep subject_name as written.
- kind: partial ("parcijala", "kolokvij", midterm), final ("završni"), integral ("integralni"),
  makeup ("popravni"), other. number: ordinal of a partial ("II parcijala" = 2), else null.
- time: start time HH:MM when given, else null.`

const TIMETABLE_RULES = `Weekly class timetable -> "entries", one per class slot in the week:
- subject_id: the id of the matching subject from the given list (match by meaning:
  abbreviations, missing diacritics, typos). null if none matches; keep subject_name as written.
- kind: lecture ("P", "predavanja"), exercise ("V", "AV", "vježbe", tutorial), lab ("LV",
  "laboratorijske", "lab"), other.
- weekday 0 = Monday … 6 = Sunday; start and end HH:MM (24 h). "od 9 do 10:30" = 09:00–10:30.
  A class without an end time lasts 90 minutes; say so in "warnings".
- location: the room as written ("S1", "Lab 2"), else null.
- week_parity: "odd" for odd weeks ("neparne sedmice"), "even" for even weeks, else null.
- note: any other remark for that class (a group, "online"), else null.
- If the student's note names a year, group or study programme, keep only those classes.`

const DOCUMENT_RULES = `Document kind: academic_calendar, exam_schedule, rules (rulebook,
"pravilnik"), syllabus ("silabus", course plan), notice ("obavještenje"), other.`

interface ParseVariant {
  task: AiTask
  schema: z.ZodType
  rules: string
}

const VARIANTS: Record<ImportKind, ParseVariant> = {
  academic_calendar: {
    task: 'parse_academic_calendar',
    schema: calendarParseSchema,
    rules: CALENDAR_RULES,
  },
  exam_schedule: {
    task: 'parse_exam_schedule',
    schema: examScheduleParseSchema,
    rules: EXAM_RULES,
  },
  timetable: {
    task: 'parse_timetable',
    schema: timetableParseSchema,
    rules: TIMETABLE_RULES,
  },
  document: { task: 'parse_document', schema: documentParseSchema, rules: DOCUMENT_RULES },
  auto: {
    task: 'parse_document',
    schema: autoParseSchema,
    rules: `First decide the document kind. ${DOCUMENT_RULES}
Fill "periods" only for an academic calendar and "exams" only for an exam schedule; else [].

${CALENDAR_RULES}

${EXAM_RULES}`,
  },
}

export function parseRequest(
  req: ParseDocumentRequest,
  files: LlmFile[],
): LlmRequest<Record<string, unknown>> {
  const variant = VARIANTS[req.kind]
  const lines = [`Today: ${req.today}`, `User language: ${LANGUAGE[req.locale]}`]
  const matchesSubjects =
    req.kind === 'exam_schedule' || req.kind === 'auto' || req.kind === 'timetable'
  if (matchesSubjects && req.subjects.length > 0) {
    lines.push('Subjects (id: name):', ...req.subjects.map((s) => `${s.id}: ${s.name}`))
  }
  if (req.note) {
    // The student's own hint narrows what to extract; it never replaces what the document says.
    lines.push(
      "Student's note about this document (follow it to choose what to extract, e.g. which " +
        'year or group; never invent dates from it):',
      req.note,
    )
  }
  if (req.text) {
    lines.push('Document text:')
    for (const p of req.text) lines.push(`--- page ${p.page} ---`, p.text)
  } else {
    lines.push('The document is the attached file.')
  }
  return {
    task: variant.task,
    system: `${PARSE_SYSTEM}\n\n${variant.rules}`,
    text: lines.join('\n'),
    files,
    schema: variant.schema as z.ZodType<Record<string, unknown>>,
    // A transcription of a scanned file needs room; extraction alone stays small.
    maxTokens: req.text ? 8000 : 16000,
  }
}

type AnyParse = Partial<z.infer<typeof autoParseSchema>>

/** Maps every parse variant to one shape and drops what the model got inconsistent. */
export function normalizeParse(req: ParseDocumentRequest, data: AnyParse): ParseResult {
  // A timetable is kept as an "other" document; its classes come as `entries`.
  const kind =
    req.kind === 'academic_calendar' || req.kind === 'exam_schedule'
      ? req.kind
      : req.kind === 'timetable'
        ? 'other'
        : (data.kind ?? 'other')
  const subjectIds = new Set(req.subjects.map((s) => s.id))
  const periods =
    kind === 'academic_calendar'
      ? (data.periods ?? []).flatMap((p) => {
          if (p.ends_on < p.starts_on) return []
          const exam_session = p.kind === 'exam' ? (p.exam_session ?? 'regular') : null
          return [{ ...p, exam_session }]
        })
      : []
  const exams =
    kind === 'exam_schedule'
      ? (data.exams ?? []).map((e) => ({
          ...e,
          subject_id: e.subject_id && subjectIds.has(e.subject_id) ? e.subject_id : null,
        }))
      : []
  const entries =
    req.kind === 'timetable'
      ? ((data as { entries?: ParsedClass[] }).entries ?? []).flatMap((e) =>
          e.end <= e.start
            ? []
            : [
                {
                  ...e,
                  subject_id: e.subject_id && subjectIds.has(e.subject_id) ? e.subject_id : null,
                },
              ],
        )
      : []
  return {
    kind,
    title: data.title ?? '',
    pages: req.text ? [] : (data.pages ?? []).filter((p) => p.text.trim() !== ''),
    periods,
    exams,
    entries,
    warnings: data.warnings ?? [],
  }
}

// ---------------------------------------------------------------------------
// answer
// ---------------------------------------------------------------------------

export interface Passage {
  document_id: string
  title: string
  page: number | null
  content: string
}

/**
 * Prompt order for caching: system and STATE first (stable within a conversation), then the
 * conversation, the passages found for this question and the question itself.
 */
export function answerRequest(req: AnswerRequest, passages: Passage[]): LlmRequest<AnswerOutput> {
  const system = `You are Sova, the owl assistant in Hoot, a study planner for one student.
Answer in ${LANGUAGE[req.locale]}, briefly (at most 4 sentences), plain text without markdown.
Address the student informally ("ti" in Bosnian), warm but to the point.
Use only two sources:
1. PASSAGES: numbered excerpts from the student's own university documents. List the numbers
   you rely on in "passages".
2. STATE: a JSON summary of subjects, exams, points, grades and the academic calendar.
   Questions about points, grades, exam dates or the plan are answered from STATE; list what
   you used in "state_refs".
If neither source contains the answer, say so and suggest giving the owl the right document.
Never invent dates, rules or numbers. Today is ${req.today}.
You never add, change or delete anything yourself and never claim you did. Instead you can pick
one "action"; the app runs it next to your answer and the student confirms anything it changes:
- search_notes: the student looks for their own notes or cards ("gdje sam pisala o …", "where
  did I write about …"). action_text = the topic to look for. Say you are looking; the app lists
  the notes (you do not see them).
- quiz: the student wants to be tested on a chapter ("ispitaj me iz …"). action_text = the chapter
  title as the student said it.
- add_timetable: the student wants to add their weekly class timetable. Tell them to give it as a
  photo, PDF or text; the app opens the form.
- add_contents: the student wants to add a textbook's table of contents or a list of exam
  questions. action_text = the subject name from STATE, or null.
- import_document: the student asks to import something from a document already given in this
  conversation ("ubaci mi ovo", "dodaj sve parcijale iz ovoga"). import_kind = academic_calendar,
  exam_schedule or timetable. Say you will show what you find for them to save.
- An academic calendar or exams from a document not given yet: tell them to give it with the +
  button and pick its kind (action none). Anything else: say it is not possible from the chat yet.
Otherwise action is none, action_text and import_kind are null.
`
  const lines: string[] = []
  if (req.history.length > 0) {
    lines.push('CONVERSATION SO FAR:')
    for (const m of req.history) lines.push(`${m.role === 'user' ? 'Student' : 'Sova'}: ${m.text}`)
  }
  lines.push('PASSAGES:')
  if (passages.length === 0) lines.push('(none)')
  passages.forEach((p, i) => {
    const where = p.page ? `${p.title}, page ${p.page}` : p.title
    lines.push(`[${i + 1}] ${where}`, p.content)
  })
  lines.push('QUESTION:', req.question)
  return {
    task: 'answer',
    system,
    // Stable within a conversation, so it sits right after the system prompt and is cached.
    prefix: `STATE:\n${req.state}`,
    text: lines.join('\n'),
    schema: answerOutputSchema,
    maxTokens: 1500,
  }
}

/** Citations from the passage numbers the model used, one per document page. */
export function citationsFor(output: AnswerOutput, passages: Passage[]) {
  const seen = new Set<string>()
  const citations: { document_id: string; title: string; page: number | null }[] = []
  for (const n of output.passages) {
    const p = passages[n - 1]
    if (!p) continue
    const key = `${p.document_id}:${p.page ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    citations.push({ document_id: p.document_id, title: p.title, page: p.page })
  }
  return citations
}

/** Standard base64 for file bytes sent to a provider. */
export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/** An action without what it needs falls back to none. */
export function normalizeAction(output: AnswerOutput) {
  const text = output.action_text?.trim() || null
  const needsText = output.action === 'search_notes' || output.action === 'quiz'
  if ((needsText && !text) || (output.action === 'import_document' && !output.import_kind))
    return { action: 'none' as const, action_text: null, import_kind: null }
  return {
    action: output.action,
    action_text: output.action === 'add_timetable' ? null : text,
    import_kind: output.action === 'import_document' ? output.import_kind : null,
  }
}

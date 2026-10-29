// One Zod schema per AI input/output, shared by Edge Functions (Deno) and the frontend (`@shared/`).
// Structured-output rules: no recursion, flat objects, `nullable` instead of optional fields.
import { z } from 'zod'

const isoDate = z.iso.date()
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const LOCALES = ['bs', 'en'] as const
export const localeSchema = z.enum(LOCALES)

/** What the user says is inside an uploaded document; `auto` lets the owl guess. */
export const IMPORT_KINDS = [
  'auto',
  'academic_calendar',
  'exam_schedule',
  'timetable',
  'syllabus',
  'document',
] as const
export const importKindSchema = z.enum(IMPORT_KINDS)
export type ImportKind = z.infer<typeof importKindSchema>

/** `documents.kind`. Calendar and exam schedule also produce an import proposal. */
export const DOCUMENT_KINDS = [
  'academic_calendar',
  'exam_schedule',
  'rules',
  'syllabus',
  'notice',
  'other',
] as const
export const documentKindSchema = z.enum(DOCUMENT_KINDS)
export type DocumentKind = z.infer<typeof documentKindSchema>

export const pageTextSchema = z.object({
  page: z.int().min(1),
  text: z.string(),
})
export type PageText = z.infer<typeof pageTextSchema>

// ---------------------------------------------------------------------------
// parse-document output
// ---------------------------------------------------------------------------

export const parsedPeriodSchema = z.object({
  kind: z.enum(['teaching', 'exam', 'holiday']),
  exam_session: z
    .enum(['partial', 'regular', 'makeup'])
    .nullable()
    .describe('Only for kind=exam: partial = week of partial exams, regular, makeup'),
  title: z.string().min(1),
  starts_on: isoDate,
  ends_on: isoDate,
})
export type ParsedPeriod = z.infer<typeof parsedPeriodSchema>

export const parsedExamSchema = z.object({
  subject_name: z.string().min(1).describe('Subject name exactly as written in the document'),
  subject_id: z
    .string()
    .nullable()
    .describe('id of the matching subject from the given list, null if none matches'),
  kind: z.enum(['partial', 'final', 'integral', 'makeup', 'other']),
  number: z
    .int()
    .min(1)
    .max(9)
    .nullable()
    .describe('Ordinal of a partial exam: "II parcijala" = 2'),
  date: isoDate,
  time: clock.nullable().describe('Start time HH:MM, null if not given'),
})
export type ParsedExam = z.infer<typeof parsedExamSchema>

/** A weekly class from a timetable ("Raspored nastave", task parse_timetable). */
export const parsedClassSchema = z.object({
  subject_name: z.string().min(1).describe('Subject name exactly as written in the timetable'),
  subject_id: z
    .string()
    .nullable()
    .describe('id of the matching subject from the given list, null if none matches'),
  kind: z
    .enum(['lecture', 'exercise', 'lab', 'other'])
    .describe('lecture ("P", predavanje), exercise ("AV", vježbe), lab ("LV", laboratorija)'),
  weekday: z.int().min(0).max(6).describe('0 = Monday … 6 = Sunday'),
  start: clock,
  end: clock,
  location: z.string().nullable().describe('Room as written, null if not given'),
  week_parity: z
    .enum(['odd', 'even'])
    .nullable()
    .describe('Only when the class is every other week ("neparne sedmice" = odd)'),
  note: z.string().nullable().describe('Other remarks for this class, e.g. a group; else null'),
})
export type ParsedClass = z.infer<typeof parsedClassSchema>

/** One subject of a syllabus ("Plan i program", task parse_syllabus, Stage 10c). */
export const parsedSyllabusSubjectSchema = z.object({
  subject_name: z.string().min(1).describe('Subject name exactly as written in the document'),
  subject_id: z
    .string()
    .nullable()
    .describe('id of the matching subject from the given list, null if none matches'),
  semester: z.int().min(1).max(12).nullable().describe('Semester number if written, else null'),
  elective_group: z
    .string()
    .nullable()
    .describe(
      'Elective slot this subject is an option of ("Izborni predmet 4.1"), null if required',
    ),
  literature: z.array(
    z.object({
      title: z.string().min(1),
      authors: z.string().nullable(),
      required: z.boolean().describe('true = obavezna (required), false = dopunska (extra)'),
    }),
  ),
  topics: z
    .array(
      z.object({
        week: z.int().min(1).max(20).nullable().describe('Teaching week, null if not given'),
        name: z.string().min(1).describe('Topic or chapter heading, short'),
      }),
    )
    .describe('Weekly plan of lectures, or the numbered chapters of the content, in order'),
  grading: z
    .array(
      z.object({
        kind: z.enum([
          'partial',
          'final',
          'integral',
          'makeup',
          'attendance',
          'assignment',
          'seminar',
          'other',
        ]),
        number: z.int().min(1).max(9).nullable().describe('Ordinal of a partial: "II" = 2'),
        title: z.string().min(1).describe('As written, e.g. "I parcijalni ispit", "Prisustvo"'),
        points: z
          .number()
          .min(0)
          .max(1000)
          .nullable()
          .describe('Maximum points, null if not given'),
        pass_points: z
          .number()
          .min(0)
          .max(1000)
          .nullable()
          .describe('Points needed to pass this item, null if not given'),
      }),
    )
    .describe('How the grade is made: exams and other point items'),
})
export type ParsedSyllabusSubject = z.infer<typeof parsedSyllabusSubjectSchema>

const parseBase = {
  title: z.string().min(1).describe('Short document title, in the document language'),
  pages: z
    .array(pageTextSchema)
    .describe('Plain-text transcription per page; empty when the text was already provided'),
  warnings: z.array(z.string()),
}

export const calendarParseSchema = z.object({
  ...parseBase,
  periods: z.array(parsedPeriodSchema),
})

export const examScheduleParseSchema = z.object({
  ...parseBase,
  exams: z.array(parsedExamSchema),
})

export const timetableParseSchema = z.object({
  ...parseBase,
  entries: z.array(parsedClassSchema),
})

export const syllabusParseSchema = z.object({
  ...parseBase,
  subjects: z.array(parsedSyllabusSubjectSchema),
})

export const documentParseSchema = z.object({
  ...parseBase,
  kind: documentKindSchema,
})

/** "Pogodi sama": one call recognizes the kind and extracts whatever matches it. */
export const autoParseSchema = z.object({
  ...parseBase,
  kind: documentKindSchema,
  periods: z.array(parsedPeriodSchema).describe('Only for an academic calendar, else empty'),
  exams: z.array(parsedExamSchema).describe('Only for an exam schedule, else empty'),
})

/** Normalized result every parse variant is mapped to. */
export interface ParseResult {
  kind: DocumentKind
  title: string
  pages: PageText[]
  periods: ParsedPeriod[]
  exams: ParsedExam[]
  /** Weekly classes; only for kind `timetable` (stored as an `other` document). */
  entries: ParsedClass[]
  /** Per subject; only for kind `syllabus` (Stage 10c). */
  syllabus: ParsedSyllabusSubject[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// parse-document request
// ---------------------------------------------------------------------------

export const UPLOAD_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const
export const uploadMediaTypeSchema = z.enum(UPLOAD_MEDIA_TYPES)
export type UploadMediaType = z.infer<typeof uploadMediaTypeSchema>

/** Pasted or extracted text sent to the model is capped to stay small (free tier, cost). */
export const MAX_DOCUMENT_CHARS = 60_000
/** "Poruka sovi" sent along with a document. */
export const MAX_NOTE_CHARS = 500

export const parseDocumentRequestSchema = z
  .object({
    document_id: z.uuid(),
    kind: importKindSchema,
    locale: localeSchema,
    today: isoDate,
    /** Text per page (pasted text or a PDF text layer); null when only a file is sent. */
    text: z.array(pageTextSchema).max(200).nullable(),
    /** Image or scanned PDF in the `uploads` bucket: `<user_id>/documents/<file>`. */
    file: z.object({ path: z.string().min(1), media_type: uploadMediaTypeSchema }).nullable(),
    /** Active subjects, so the model can link exams; diffing against existing exams is local. */
    subjects: z.array(z.object({ id: z.uuid(), name: z.string() })).max(60),
    /** What the student says about the document, e.g. "only 2nd year, group B". */
    note: z.string().trim().max(MAX_NOTE_CHARS).nullable().optional(),
    /** Syllabus of a whole programme: only the subjects of this year of study (profile). */
    year_of_study: z.int().min(1).max(6).nullable().optional(),
  })
  .refine((r) => r.text !== null || r.file !== null, { message: 'text or file is required' })
  .refine((r) => !r.text || r.text.reduce((n, p) => n + p.text.length, 0) <= MAX_DOCUMENT_CHARS, {
    message: 'text too long',
  })
export type ParseDocumentRequest = z.infer<typeof parseDocumentRequestSchema>

// ---------------------------------------------------------------------------
// find-academic-info (Stage 10c): web search for the academic calendar and syllabus
// ---------------------------------------------------------------------------

export const FOUND_KINDS = ['academic_calendar', 'syllabus', 'other'] as const

export const foundDocumentSchema = z.object({
  kind: z.enum(FOUND_KINDS),
  title: z.string().min(1).describe('Title of the page or document as shown'),
  url: z.string().describe('Full https URL of the document or page, exactly as found'),
  academic_year: z
    .string()
    .nullable()
    .describe('Academic year it is for, as "2026/27", null if not stated'),
})
export type FoundDocument = z.infer<typeof foundDocumentSchema>

export const findAcademicInfoOutputSchema = z.object({
  documents: z.array(foundDocumentSchema).max(10),
})

/** Only the faculty, the programme and the year go to the web search (PRD). */
export const findAcademicInfoRequestSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('search'),
    institution: z.string().trim().min(2).max(120),
    program: z.string().trim().max(120).nullable(),
    year_of_study: z.int().min(1).max(6).nullable(),
    academic_year: z.string().regex(/^\d{4}\/\d{2}$/),
    locale: localeSchema,
  }),
  /** Downloads a found document, or a public link the user pasted, for parse-document. */
  z.object({ op: z.literal('fetch'), url: z.url().max(2048) }),
])
export type FindAcademicInfoRequest = z.infer<typeof findAcademicInfoRequestSchema>

/** What `profiles.academic_search` keeps: the search key and what was found (checked links). */
export interface AcademicSearch {
  key: string
  searched_at: string
  documents: FoundDocument[]
}

// ---------------------------------------------------------------------------
// documents (chunks + embeddings, no LLM)
// ---------------------------------------------------------------------------

/**
 * Chunks per `documents` call. gte-small runs inside the Edge Function's CPU budget: two
 * 1000-character chunks fit reliably, three or more sometimes hit WORKER_RESOURCE_LIMIT.
 */
export const EMBED_BATCH = 2

export const embedChunksRequestSchema = z.object({
  document_id: z.uuid(),
  chunks: z
    .array(
      z.object({
        id: z.uuid(),
        page: z.int().min(1).nullable(),
        position: z.int().min(0),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(EMBED_BATCH),
})
export type EmbedChunksRequest = z.infer<typeof embedChunksRequestSchema>

// ---------------------------------------------------------------------------
// parse-toc, parse-questions, link-questions (AI content import, Stage 10)
// ---------------------------------------------------------------------------

/** An uploaded image (or PDF) in `<user_id>/<folder>/…`; deleted by the function after reading. */
export const uploadedFileSchema = z.object({
  path: z.string().min(1).max(300),
  media_type: uploadMediaTypeSchema,
})
export type UploadedFile = z.infer<typeof uploadedFileSchema>

/** Photos of a table of contents or a question list per call (PRD: 1–4). */
export const MAX_IMPORT_FILES = 4
export const MAX_IMPORT_TEXT = 20_000
export const MAX_TOPIC_NAME = 60
/** Existing topics of the subject sent so the model reuses them instead of near-duplicates. */
export const MAX_PROMPT_TOPICS = 150

const topicNames = z
  .array(z.string().trim().min(1).max(MAX_TOPIC_NAME))
  .max(3)
  .describe('1-3 topics; reuse an existing topic name exactly when it fits')

export const parsedTocUnitSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(20)
    .describe('Number as printed ("4", "4.1", "4.1.2"); when there is none, the position "1", "2"'),
  title: z.string().min(1).max(200),
  page_start: z
    .int()
    .min(1)
    .nullable()
    .describe('First page (slides: first slide); null if not printed'),
  page_end: z.int().min(1).nullable().describe('Last page only when printed, else null'),
  ai_difficulty: z.int().min(1).max(5).describe('1 easy … 5 hard, relative within this subject'),
  topics: topicNames,
})
export type ParsedTocUnit = z.infer<typeof parsedTocUnitSchema>

export const tocParseSchema = z.object({
  units: z.array(parsedTocUnitSchema).max(300),
  warnings: z.array(z.string()),
})
export type TocParse = z.infer<typeof tocParseSchema>

const importBase = {
  subject: z.string().trim().min(1).max(120),
  locale: localeSchema,
  files: z.array(uploadedFileSchema).max(MAX_IMPORT_FILES),
  text: z.string().max(MAX_IMPORT_TEXT).nullable(),
  topics: z.array(z.string().trim().min(1).max(MAX_TOPIC_NAME)).max(MAX_PROMPT_TOPICS),
}

export const parseTocRequestSchema = z
  .object({
    ...importBase,
    source_kind: z.enum(['book', 'script', 'slides', 'other']),
    measure: z.enum(['pages', 'slides', 'items']),
    title: z.string().trim().max(120),
    /**
     * "Procijeni težinu AI-jem" for a manual outline: the units are given, the model only rates
     * difficulty and picks topics (no files, no text).
     */
    units: z
      .array(z.object({ label: z.string().min(1).max(20), title: z.string().min(1).max(200) }))
      .max(300)
      .nullable(),
  })
  .refine((r) => r.files.length > 0 || Boolean(r.text?.trim()) || (r.units?.length ?? 0) > 0, {
    message: 'files, text or units are required',
  })
export type ParseTocRequest = z.infer<typeof parseTocRequestSchema>

export const parsedQuestionSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(20)
    .describe(
      'Question number as printed ("8" -> "P8"); when there is none, "P1", "P2" by position',
    ),
  title: z.string().min(1).max(600).describe('The full question text as written'),
  topics: topicNames,
})
export type ParsedQuestion = z.infer<typeof parsedQuestionSchema>

export const questionsParseSchema = z.object({
  questions: z.array(parsedQuestionSchema).max(300),
  warnings: z.array(z.string()),
})
export type QuestionsParse = z.infer<typeof questionsParseSchema>

export const parseQuestionsRequestSchema = z
  .object(importBase)
  .refine((r) => r.files.length > 0 || Boolean(r.text?.trim()), {
    message: 'files or text are required',
  })
export type ParseQuestionsRequest = z.infer<typeof parseQuestionsRequestSchema>

/** Questions per link-questions call; candidates come from embeddings (question_candidates). */
export const MAX_LINK_QUESTIONS = 60
export const LINK_CANDIDATES = 5

export const linkQuestionsRequestSchema = z.object({
  locale: localeSchema,
  question_ids: z.array(z.uuid()).min(1).max(MAX_LINK_QUESTIONS),
})
export type LinkQuestionsRequest = z.infer<typeof linkQuestionsRequestSchema>

export const linkOutputSchema = z.object({
  links: z
    .array(
      z.object({
        question: z.int().min(1).describe('Number of the question'),
        chapters: z
          .array(z.int().min(1))
          .max(2)
          .describe('Numbers of the candidate chapters the question is about; [] if none fits'),
      }),
    )
    .describe('One entry per question'),
})
export type LinkOutput = z.infer<typeof linkOutputSchema>

export interface QuestionLinkSuggestion {
  question_id: string
  unit_id: string
  similarity: number
}

export interface LinkQuestionsResponse {
  links: QuestionLinkSuggestion[]
}

// ---------------------------------------------------------------------------
// recall-questions, propose-answer (testing without the book's text, Stage 10)
// ---------------------------------------------------------------------------

/** Where AI questions come from (`review_logs.source` of their ratings). */
export const RECALL_AI_SOURCES = ['notes', 'page_photo', 'general'] as const
export type RecallAiSource = (typeof RECALL_AI_SOURCES)[number]

/** 3 for the recall gate, 5–10 for a quiz (PRD "Testiranje bez sadržaja literature"). */
export const GATE_QUESTIONS = 3
export const QUIZ_QUESTIONS = 6
export const MAX_RECALL_QUESTIONS = 10
/** Photos of a page or two (e.g. the chapter summary). */
export const MAX_PAGE_PHOTOS = 2

export const recallQuestionsRequestSchema = z
  .object({
    unit_id: z.uuid(),
    source: z.enum(RECALL_AI_SOURCES),
    count: z.int().min(1).max(MAX_RECALL_QUESTIONS),
    locale: localeSchema,
    files: z.array(uploadedFileSchema).max(MAX_PAGE_PHOTOS),
  })
  .refine((r) => (r.source === 'page_photo') === r.files.length > 0, {
    message: 'page photos only for page_photo',
  })
export type RecallQuestionsRequest = z.infer<typeof recallQuestionsRequestSchema>

export const recallOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1).describe('A short question in the user language'),
        answer: z.string().min(1).describe('The correct answer, 1-3 sentences'),
      }),
    )
    .describe('Exactly the requested number of questions, each answerable from the material'),
})
export type RecallOutput = z.infer<typeof recallOutputSchema>

export interface RecallQuestion {
  question: string
  answer: string
}

export interface RecallQuestionsResponse {
  source: RecallAiSource
  questions: RecallQuestion[]
}

export const proposeAnswerRequestSchema = z.object({
  question_id: z.uuid(),
  locale: localeSchema,
})
export type ProposeAnswerRequest = z.infer<typeof proposeAnswerRequestSchema>

export const proposeAnswerOutputSchema = z.object({
  answer: z
    .string()
    .min(1)
    .describe('A concise exam answer in the user language; markdown lists and $math$ allowed'),
})
export type ProposeAnswerOutput = z.infer<typeof proposeAnswerOutputSchema>

// ---------------------------------------------------------------------------
// embed (gte-small vectors of units, cards and topics; no LLM)
// ---------------------------------------------------------------------------

export const EMBED_KINDS = ['unit', 'card', 'topic'] as const
export type EmbedKind = (typeof EMBED_KINDS)[number]

/** Rows sent per `embed` call; the function stops earlier when the text budget is used up. */
export const EMBED_ROWS = 8

export const embedRequestSchema = z.discriminatedUnion('op', [
  /** Embed stored rows (read through RLS) and save their vectors. */
  z.object({
    op: z.literal('store'),
    items: z
      .array(z.object({ kind: z.enum(EMBED_KINDS), id: z.uuid() }))
      .min(1)
      .max(EMBED_ROWS),
  }),
  /** Vectors of short texts that are not stored yet (topic names before a save). */
  z.object({
    op: z.literal('vectors'),
    texts: z.array(z.string().trim().min(1).max(200)).min(1).max(EMBED_ROWS),
  }),
  /** "Gdje sam pisala o …": nearest notes and cards to a query. */
  z.object({
    op: z.literal('search_notes'),
    query: z.string().trim().min(1).max(500),
  }),
])
export type EmbedRequest = z.infer<typeof embedRequestSchema>

export interface EmbedStoreResponse {
  /** Rows embedded in this call; the rest is sent again. */
  done: string[]
}

export interface EmbedVectorsResponse {
  vectors: number[][]
}

export interface NoteMatch {
  kind: 'unit' | 'card'
  id: string
  unit_id: string
  similarity: number
}

export interface SearchNotesResponse {
  matches: NoteMatch[]
}

// ---------------------------------------------------------------------------
// answer
// ---------------------------------------------------------------------------

export const STATE_TOPICS = ['grades', 'exams', 'calendar', 'plan'] as const

/**
 * What the app can do next to an answer (Stage 10 tools). The app runs it and shows a card; the
 * assistant itself never changes anything.
 */
export const OWL_ACTIONS = [
  'none',
  'search_notes',
  'quiz',
  'add_timetable',
  'add_contents',
  'import_document',
] as const
export type OwlActionKind = (typeof OWL_ACTIONS)[number]
export const REIMPORT_KINDS = ['academic_calendar', 'exam_schedule', 'timetable'] as const
export type ReimportKind = (typeof REIMPORT_KINDS)[number]

export const answerOutputSchema = z.object({
  answer: z.string().min(1).describe('Short answer in the user language, plain text'),
  passages: z
    .array(z.int().min(1))
    .describe('Numbers of the document passages the answer relies on; empty if none'),
  state_refs: z
    .array(
      z.object({
        subject: z.string().nullable().describe('Subject name from the state summary, or null'),
        topic: z.enum(STATE_TOPICS),
      }),
    )
    .describe('Parts of the state summary the answer relies on; empty if none'),
  action: z.enum(OWL_ACTIONS).describe('A tool the app runs next to the answer; none if none fits'),
  action_text: z
    .string()
    .nullable()
    .describe(
      'search_notes: what to look for; quiz: the chapter title; add_contents: the subject name; else null',
    ),
  import_kind: z
    .enum(REIMPORT_KINDS)
    .nullable()
    .describe('import_document: what the given document contains; else null'),
})
export type AnswerOutput = z.infer<typeof answerOutputSchema>

export const MAX_STATE_CHARS = 12_000

export const answerRequestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(['user', 'owl']), text: z.string().max(2000) })).max(6),
  /** Compact JSON summary of subjects, exams, points and calendar built on the client. */
  state: z.string().max(MAX_STATE_CHARS),
  locale: localeSchema,
  today: isoDate,
  /** Conversation the question belongs to; keeps its prompt cache. */
  conversation_id: z.uuid().nullable().optional(),
  /** Server-sent events: the answer text as it is written, then the whole response. */
  stream: z.boolean().optional(),
})
export type AnswerRequest = z.infer<typeof answerRequestSchema>

export interface Citation {
  document_id: string
  title: string
  page: number | null
}

export interface AnswerResponse {
  answer: string
  citations: Citation[]
  state_refs: AnswerOutput['state_refs']
  action: OwlActionKind
  action_text: string | null
  import_kind: ReimportKind | null
}

// ---------------------------------------------------------------------------
// ai-status
// ---------------------------------------------------------------------------

export interface AiStatus {
  enabled: boolean
  /** AI calls left in the rolling 24 h window. */
  remaining: number
  limit: number
}

/** Error codes returned by Edge Functions as `{ error: code }`. */
export const AI_ERRORS = [
  'unauthorized',
  'bad_request',
  'no_key',
  'rate_limited',
  'quota_exhausted',
  'provider_busy',
  'invalid_output',
  'failed',
] as const
export type AiErrorCode = (typeof AI_ERRORS)[number]

// ---------------------------------------------------------------------------
// Session presets (`profiles.session_presets`; not an AI schema, shared for the notify function)
// ---------------------------------------------------------------------------

/** One step of a custom preset: minutes of study or of a break. */
export const presetStepSchema = z.object({
  kind: z.enum(['work', 'break']),
  min: z.int().min(1).max(180),
})
export type PresetStep = z.infer<typeof presetStepSchema>

/**
 * A custom preset ("Vlastiti"): steps that repeat, starting with study and alternating with
 * breaks (45 → 10 → 45 → 20), plus an optional long break after every N study intervals.
 */
export const sessionPresetSchema = z
  .object({
    id: z.string().regex(/^custom:[0-9a-f-]{36}$/),
    name: z.string().trim().min(1).max(40),
    steps: z.array(presetStepSchema).min(2).max(12),
    long_break: z.object({ every: z.int().min(2).max(12), min: z.int().min(5).max(60) }).nullable(),
  })
  .refine(
    (p) =>
      p.steps.length % 2 === 0 && p.steps.every((s, i) => s.kind === (i % 2 ? 'break' : 'work')),
    { message: 'steps alternate study and break, starting with study', path: ['steps'] },
  )
export type SessionPreset = z.infer<typeof sessionPresetSchema>

export const MAX_CUSTOM_PRESETS = 8
export const sessionPresetsSchema = z.array(sessionPresetSchema).max(MAX_CUSTOM_PRESETS)

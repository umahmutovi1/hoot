// One Zod schema per AI input/output, shared by Edge Functions (Deno) and the frontend (`@shared/`).
// Structured-output rules: no recursion, flat objects, `nullable` instead of optional fields.
import { z } from 'zod'

const isoDate = z.iso.date()
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const LOCALES = ['bs', 'en'] as const
export const localeSchema = z.enum(LOCALES)

/** What the user says is inside an uploaded document; `auto` lets the owl guess. */
export const IMPORT_KINDS = ['auto', 'academic_calendar', 'exam_schedule', 'document'] as const
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
    subjects: z.array(z.object({ id: z.uuid(), name: z.string() })).max(60),
    exams: z
      .array(
        z.object({
          id: z.uuid(),
          subject_id: z.uuid(),
          kind: z.string(),
          title: z.string(),
          date: isoDate,
        }),
      )
      .max(200),
  })
  .refine((r) => r.text !== null || r.file !== null, { message: 'text or file is required' })
  .refine((r) => !r.text || r.text.reduce((n, p) => n + p.text.length, 0) <= MAX_DOCUMENT_CHARS, {
    message: 'text too long',
  })
export type ParseDocumentRequest = z.infer<typeof parseDocumentRequestSchema>

// ---------------------------------------------------------------------------
// documents (chunks + embeddings, no LLM)
// ---------------------------------------------------------------------------

export const EMBED_BATCH = 16

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
// answer
// ---------------------------------------------------------------------------

export const STATE_TOPICS = ['grades', 'exams', 'calendar', 'plan'] as const

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
  'provider_busy',
  'invalid_output',
  'failed',
] as const
export type AiErrorCode = (typeof AI_ERRORS)[number]

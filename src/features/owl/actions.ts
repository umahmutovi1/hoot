// What the owl does when it gets a document or a question. Plain async functions over the
// store, so a flow keeps going when the user navigates between Today and the conversation.
import type { QueryClient } from '@tanstack/react-query'
import {
  EMBED_BATCH,
  MAX_DOCUMENT_CHARS,
  type AnswerRequest,
  type AnswerResponse,
  type DocumentKind,
  type ImportKind,
  type ParseDocumentRequest,
  type ParseResult,
  type ReimportKind,
  type UploadMediaType,
} from '@shared/schemas.ts'
import { chunkPages, type PageText } from '@/lib/documents/chunk'
import { compressImage } from '@/lib/image'
import {
  proposeClasses,
  proposeExams,
  proposePeriods,
  type ExistingClass,
  type ExistingExam,
  type ExistingPeriod,
} from '@/lib/import'
import { supabase } from '@/lib/supabase'
import { proposeSyllabus, type SyllabusExisting } from '@/lib/import/syllabus'
import { localDateOf, type SubjectWithAssessments } from '@/features/subjects/model'
import { AiCallError, aiStatusKey, documentsKey, invokeAi } from './api'
import { pdfText } from './pdfText'
import { searchNotes } from './embeddings'
import {
  historyWritten,
  useOwlStore,
  type ImportProposal,
  type NoteHit,
  type OwlAction,
  type OwlMessage,
} from './store'

export type DocumentInput = { type: 'file'; file: File } | { type: 'text'; text: string }

/** A document found on the web ("Fakultet s interneta"): its link and the year it says. */
export interface DocumentOrigin {
  url: string
  academicYear: string | null
}

export interface OwlContext {
  userId: string
  locale: 'bs' | 'en'
  today: string
  subjects: SubjectWithAssessments[]
  periods: {
    id: string
    kind: string
    exam_session: string | null
    title: string
    starts_on: string
    ends_on: string
  }[]
  /** Classes of the current teaching period, for a timetable import. */
  classes: ExistingClass[]
  queryClient: QueryClient
}

const id = () => crypto.randomUUID()
const store = () => useOwlStore.getState()

function fail(pendingId: string, err: unknown) {
  const code = err instanceof AiCallError ? err.code : 'failed'
  store().replace(pendingId, { id: pendingId, role: 'owl', type: 'error', code })
}

/** Local date and HH:MM of a stored exam, in the device's time zone like the rest of the app. */
function localTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function existingExams(subjects: SubjectWithAssessments[]): ExistingExam[] {
  return subjects.flatMap((s) =>
    s.assessments.map((a) => ({
      id: a.id,
      subjectId: s.id,
      title: a.title,
      kind: a.kind,
      date: localDateOf(a.at),
      time: localTime(a.at),
      dateLatest: a.at_latest ? localDateOf(a.at_latest) : null,
      tentative: a.date_tentative,
      passed: a.passed,
    })),
  )
}

function capText(pages: PageText[]): PageText[] {
  const out: PageText[] = []
  let left = MAX_DOCUMENT_CHARS
  for (const p of pages) {
    if (left <= 0) break
    const text = p.text.slice(0, left)
    out.push({ page: p.page, text })
    left -= text.length
  }
  return out
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/**
 * Give the owl a document: keep it in Documents (file + passages for answers) right away, and
 * for a calendar or exam schedule add a proposal that waits for "Spasi".
 */
export async function giveDocument(
  input: DocumentInput,
  kind: ImportKind,
  note: string | null,
  ctx: OwlContext,
  origin: DocumentOrigin | null = null,
) {
  const s = store()
  if (s.busy) return
  s.setBusy(true)
  const name = input.type === 'file' ? input.file.name : input.text.split('\n')[0]!.slice(0, 60)
  s.push({ id: id(), role: 'user', type: 'file', name, ...(note ? { note } : {}) })
  const pendingId = id()
  s.push({ id: pendingId, role: 'owl', type: 'pending', stage: 'reading' })

  const documentId = id()
  let storagePath: string | null = null
  try {
    if (!navigator.onLine) throw new AiCallError('offline')

    // 1. Text we can read locally; the file itself only when there is no text layer.
    let file: File | null = null
    let text: PageText[] | null = null
    if (input.type === 'text') {
      text = [{ page: 1, text: input.text.trim() }]
    } else if (input.file.type === 'application/pdf') {
      file = input.file
      text = await pdfText(input.file).catch(() => null)
    } else if (input.file.type.startsWith('image/')) {
      file = await compressImage(input.file)
    } else {
      throw new AiCallError('bad_request')
    }
    const mediaType = file ? (file.type as UploadMediaType) : null

    if (file && mediaType) {
      storagePath = `${ctx.userId}/documents/${documentId}.${EXTENSIONS[mediaType]}`
      const { error } = await supabase.storage
        .from('uploads')
        .upload(storagePath, file, { contentType: mediaType })
      if (error) throw error
    }

    // 2. The owl reads it (one AI call, also for "Pogodi sama").
    const request: ParseDocumentRequest = {
      document_id: documentId,
      kind,
      locale: ctx.locale,
      today: ctx.today,
      text: text ? capText(text) : null,
      file:
        text || !storagePath || !mediaType ? null : { path: storagePath, media_type: mediaType },
      subjects: ctx.subjects.filter((x) => !x.archived).map((x) => ({ id: x.id, name: x.name })),
      note,
    }
    const result = await invokeAi<ParseResult>('parse-document', request)
    void ctx.queryClient.invalidateQueries({ queryKey: aiStatusKey(ctx.userId) })

    // 3. Kept in Documents with its passages.
    store().replace(pendingId, { id: pendingId, role: 'owl', type: 'pending', stage: 'storing' })
    const pages = text ?? result.pages
    const title = result.title.trim() || name
    const docKind: DocumentKind = result.kind
    // If this fails the AI result is not thrown away: the proposal below still stands.
    let stored = true
    try {
      const { error: docError } = await supabase.from('documents').insert({
        id: documentId,
        kind: docKind,
        title,
        storage_path: storagePath,
        media_type: storagePath ? mediaType : null,
        pages: pages.length || null,
      })
      if (docError) throw docError
      await storeChunks(documentId, pages)
    } catch {
      stored = false
      await removeDocument(documentId, storagePath)
    }
    void ctx.queryClient.invalidateQueries({ queryKey: documentsKey(ctx.userId) })

    // 4. A proposal for the calendar, exams or classes, never written without "Spasi".
    const proposal = { ...(await proposalFrom(result, documentId, title, ctx)), origin }
    const found = foundCount(proposal)
    const done: OwlMessage = {
      id: pendingId,
      role: 'owl',
      type: 'document',
      kind: docKind,
      title,
      documentId,
      stored,
      found,
    }
    store().replace(pendingId, done)
    if (found > 0) store().push({ id: id(), role: 'owl', type: 'proposal', proposal })
  } catch (err) {
    await removeDocument(documentId, storagePath)
    fail(pendingId, err)
  } finally {
    store().setBusy(false)
  }
}

/** Items a proposal brings (a syllabus subject counts as one). */
function foundCount(p: ImportProposal) {
  return p.periods.length + p.exams.length + (p.classes?.length ?? 0) + (p.syllabus?.length ?? 0)
}

/** What a syllabus is compared with: the subjects' sources, topics, exams and point totals. */
export async function syllabusExisting(
  ctx: Pick<OwlContext, 'subjects'>,
): Promise<SyllabusExisting> {
  const [sources, topics] = await Promise.all([
    supabase.from('sources').select('subject_id, title').is('archived_at', null),
    supabase.from('topics').select('subject_id, name'),
  ])
  return {
    sources: (sources.data ?? []).map((x) => ({ subjectId: x.subject_id, title: x.title })),
    topics: (topics.data ?? []).map((x) => ({ subjectId: x.subject_id, name: x.name })),
    exams: ctx.subjects.flatMap((x) =>
      x.assessments.map((a) => ({
        id: a.id,
        subjectId: x.id,
        kind: a.kind,
        date: localDateOf(a.at),
        pointsMax: a.points_max,
        passMinPct: a.pass_min_pct,
      })),
    ),
    pointsTotal: Object.fromEntries(ctx.subjects.map((x) => [x.id, x.points_total])),
  }
}

async function proposalFrom(
  result: ParseResult,
  documentId: string,
  title: string,
  ctx: OwlContext,
): Promise<ImportProposal> {
  const subjects = ctx.subjects.filter((x) => !x.archived)
  const syllabus = result.syllabus ?? []
  return {
    documentId,
    documentTitle: title,
    periods: proposePeriods(result.periods, ctx.periods as ExistingPeriod[]),
    exams: proposeExams(result.exams, subjects, existingExams(ctx.subjects)),
    classes: proposeClasses(result.entries ?? [], subjects, ctx.classes),
    syllabus:
      syllabus.length > 0
        ? proposeSyllabus(syllabus, subjects, await syllabusExisting(ctx))
        : undefined,
    warnings: result.warnings,
    savedCount: null,
  }
}

/**
 * "Ubaci mi ovo" (Stage 10): a document already in Documents is read again as the kind the
 * student asked for, and the result comes as a proposal card like a newly given one.
 */
async function importFromDocument(
  documentId: string,
  kind: ReimportKind,
  pendingId: string,
  ctx: OwlContext,
) {
  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, title, storage_path, media_type')
    .eq('id', documentId)
    .maybeSingle()
  if (error || !doc) throw new AiCallError('bad_request')
  const { data: chunks } = await supabase
    .from('document_chunks')
    .select('page, position, content')
    .eq('document_id', documentId)
    .order('position')
  const byPage = new Map<number, string[]>()
  for (const c of chunks ?? [])
    byPage.set(c.page ?? 1, [...(byPage.get(c.page ?? 1) ?? []), c.content])
  const text: PageText[] = [...byPage].map(([page, parts]) => ({ page, text: parts.join('\n') }))
  const request: ParseDocumentRequest = {
    document_id: documentId,
    kind,
    locale: ctx.locale,
    today: ctx.today,
    text: text.length > 0 ? capText(text) : null,
    file:
      text.length > 0 || !doc.storage_path || !doc.media_type
        ? null
        : { path: doc.storage_path, media_type: doc.media_type as UploadMediaType },
    subjects: ctx.subjects.filter((x) => !x.archived).map((x) => ({ id: x.id, name: x.name })),
    note: null,
  }
  const result = await invokeAi<ParseResult>('parse-document', request)
  void ctx.queryClient.invalidateQueries({ queryKey: aiStatusKey(ctx.userId) })
  const proposal = await proposalFrom(result, documentId, doc.title, ctx)
  const found = foundCount(proposal)
  store().replace(pendingId, {
    id: pendingId,
    role: 'owl',
    type: 'document',
    kind: 'other',
    title: doc.title,
    documentId,
    stored: true,
    found,
    again: true,
  })
  if (found > 0) store().push({ id: id(), role: 'owl', type: 'proposal', proposal })
}

/** Units and cards for "gdje sam pisala o …", with their titles; null when the search failed. */
async function notesFor(query: string): Promise<NoteHit[] | null> {
  try {
    const matches = await searchNotes(query)
    if (matches.length === 0) return []
    const unitIds = [...new Set(matches.map((m) => m.unit_id))]
    const cardIds = matches.filter((m) => m.kind === 'card').map((m) => m.id)
    const { data: units } = await supabase
      .from('units')
      .select('id, label, title, notes, source_id, sources(subject_id)')
      .in('id', unitIds)
    const { data: cards } = cardIds.length
      ? await supabase.from('cards').select('id, front').in('id', cardIds)
      : { data: [] }
    return matches.flatMap((m) => {
      const u = units?.find((x) => x.id === m.unit_id)
      if (!u) return []
      const source = u.sources as { subject_id: string } | null
      const raw =
        m.kind === 'card' ? (cards?.find((c) => c.id === m.id)?.front ?? '') : (u.notes ?? '')
      return [
        {
          kind: m.kind,
          unitId: u.id,
          subjectId: source?.subject_id ?? '',
          sourceId: u.source_id,
          title: [u.label, u.title].filter(Boolean).join(' '),
          snippet: raw.replace(/\s+/g, ' ').trim().slice(0, 140),
        },
      ]
    })
  } catch {
    return null
  }
}

/** The document the student means by "ovo": the last one given or read in this conversation. */
function lastDocumentId(): string | null {
  const messages = store().messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.type === 'document' && m.stored) return m.documentId
  }
  return null
}

/** Nothing half-stored: the document row cascades its chunks, the file goes too. */
async function removeDocument(documentId: string, storagePath: string | null) {
  await supabase.from('documents').delete().eq('id', documentId)
  if (storagePath) await supabase.storage.from('uploads').remove([storagePath])
}

/** Parallel `documents` calls; each embeds EMBED_BATCH chunks inside its CPU budget. */
const EMBED_PARALLEL = 3

async function storeChunks(documentId: string, pages: PageText[]) {
  const chunks = chunkPages(pages).map((c) => ({ ...c, id: id() }))
  const batches: (typeof chunks)[] = []
  for (let i = 0; i < chunks.length; i += EMBED_BATCH)
    batches.push(chunks.slice(i, i + EMBED_BATCH))
  const send = (batch: typeof chunks) =>
    invokeAi('documents', { document_id: documentId, chunks: batch })
  let next = 0
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++]!
      try {
        await send(batch)
      } catch {
        // A cold start or a busy worker: retry one chunk at a time (upsert, so no duplicates).
        for (const chunk of batch) await send([chunk])
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(EMBED_PARALLEL, batches.length) }, worker))
}

async function actionFor(res: AnswerResponse): Promise<OwlAction | null> {
  switch (res.action) {
    case 'search_notes':
      return res.action_text
        ? { kind: 'search_notes', text: res.action_text, hits: await notesFor(res.action_text) }
        : null
    case 'quiz':
      return res.action_text ? { kind: 'quiz', text: res.action_text } : null
    case 'add_timetable':
      return { kind: 'add_timetable' }
    case 'add_contents':
      return { kind: 'add_contents', text: res.action_text }
    case 'import_document':
      return res.import_kind
        ? { kind: 'import_document', importKind: res.import_kind, documentId: lastDocumentId() }
        : null
    default:
      return null
  }
}

/** Ask the owl; answers come from documents (cited) and the state summary. */
export async function ask(question: string, state: string, ctx: OwlContext) {
  const s = store()
  if (s.busy || !question.trim()) return
  s.setBusy(true)
  const history = s.messages
    .flatMap((m): AnswerRequest['history'] =>
      m.type === 'text'
        ? [{ role: 'user', text: m.text }]
        : m.type === 'answer'
          ? [{ role: 'owl', text: m.text }]
          : m.type === 'file'
            ? [{ role: 'user', text: `(gives a document: ${m.name})` }]
            : [],
    )
    .slice(-6)
  s.push({ id: id(), role: 'user', type: 'text', text: question.trim() })
  const pendingId = id()
  s.push({ id: pendingId, role: 'owl', type: 'pending', stage: 'thinking' })
  try {
    // The conversation row must exist before the server keeps its prompt cache on it.
    await historyWritten()
    const request: AnswerRequest = {
      conversation_id: store().conversationId,
      question: question.trim().slice(0, 1000),
      history: history.map((h) => ({ ...h, text: h.text.slice(0, 2000) })),
      state,
      locale: ctx.locale,
      today: ctx.today,
    }
    const res = await invokeAi<AnswerResponse>('answer', request)
    void ctx.queryClient.invalidateQueries({ queryKey: aiStatusKey(ctx.userId) })
    const action = await actionFor(res)
    store().replace(pendingId, {
      id: pendingId,
      role: 'owl',
      type: 'answer',
      text: res.answer,
      citations: res.citations,
      stateRefs: res.state_refs,
      ...(action ? { action } : {}),
    })
    if (action?.kind === 'import_document' && action.documentId) {
      const readingId = id()
      store().push({ id: readingId, role: 'owl', type: 'pending', stage: 'reading' })
      try {
        await importFromDocument(action.documentId, action.importKind, readingId, ctx)
      } catch (err) {
        fail(readingId, err)
      }
    }
  } catch (err) {
    fail(pendingId, err)
  } finally {
    store().setBusy(false)
  }
}

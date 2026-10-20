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
  type UploadMediaType,
} from '@shared/schemas.ts'
import { chunkPages, type PageText } from '@/lib/documents/chunk'
import { compressImage } from '@/lib/image'
import { proposeExams, proposePeriods, type ExistingExam, type ExistingPeriod } from '@/lib/import'
import { supabase } from '@/lib/supabase'
import { localDateOf, type SubjectWithAssessments } from '@/features/subjects/model'
import { AiCallError, aiStatusKey, documentsKey, invokeAi } from './api'
import { pdfText } from './pdfText'
import { historyWritten, useOwlStore, type OwlMessage } from './store'

export type DocumentInput = { type: 'file'; file: File } | { type: 'text'; text: string }

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

    // 4. A proposal for the calendar or exams, never written without "Spasi".
    const periods = proposePeriods(result.periods, ctx.periods as ExistingPeriod[])
    const exams = proposeExams(
      result.exams,
      ctx.subjects.filter((x) => !x.archived),
      existingExams(ctx.subjects),
    )
    const found = periods.length + exams.length
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
    if (found > 0) {
      store().push({
        id: id(),
        role: 'owl',
        type: 'proposal',
        proposal: {
          documentId,
          documentTitle: title,
          periods,
          exams,
          warnings: result.warnings,
          savedCount: null,
        },
      })
    }
  } catch (err) {
    await removeDocument(documentId, storagePath)
    fail(pendingId, err)
  } finally {
    store().setBusy(false)
  }
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
    store().replace(pendingId, {
      id: pendingId,
      role: 'owl',
      type: 'answer',
      text: res.answer,
      citations: res.citations,
      stateRefs: res.state_refs,
    })
    void ctx.queryClient.invalidateQueries({ queryKey: aiStatusKey(ctx.userId) })
  } catch (err) {
    fail(pendingId, err)
  } finally {
    store().setBusy(false)
  }
}

import type {
  ParseQuestionsRequest,
  ParseTocRequest,
  QuestionsParse,
  TocParse,
  UploadedFile,
  UploadMediaType,
} from '@shared/schemas.ts'
import { MAX_PROMPT_TOPICS } from '@shared/schemas.ts'
import { invokeAi } from '@/features/owl/api'
import { embedPending, parseVector, textVectors } from '@/features/owl/embeddings'
import { compressImage } from '@/lib/image'
import { supabase } from '@/lib/supabase'
import { matchTopics, topicKey, unmatchedNames, type KnownTopic } from '@/lib/topics/dedupe'

// AI content import (PRD "AI uvoz", Stage 10): photos go to `<user_id>/import/` only for the call
// (the function deletes them), the result is reviewed like manual entry, and saving writes the
// units (merge by label, sources/api.ts) plus the topics below.

/**
 * A photo (or PDF) for one AI call, in `<user_id>/<folder>/`; the function deletes it after
 * reading. Images are scaled to 1600 px; a PDF goes as it is.
 */
export async function uploadImportFile(
  userId: string,
  file: File,
  folder: 'import' | 'recall' = 'import',
): Promise<UploadedFile> {
  const pdf = file.type === 'application/pdf'
  const body = pdf ? file : await compressImage(file)
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${pdf ? 'pdf' : 'jpg'}`
  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, body, { contentType: body.type, upsert: false })
  if (error) throw error
  return { path, media_type: body.type as UploadMediaType }
}

/** Existing topic names of a subject for the prompt (the model reuses them). */
export async function subjectTopicNames(subjectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('name')
    .eq('subject_id', subjectId)
    .order('name')
    .limit(MAX_PROMPT_TOPICS)
  if (error) throw error
  return data.map((t) => t.name)
}

export const parseToc = (req: ParseTocRequest) => invokeAi<TocParse>('parse-toc', req)
export const parseQuestions = (req: ParseQuestionsRequest) =>
  invokeAi<QuestionsParse>('parse-questions', req)

async function knownTopics(subjectId: string): Promise<KnownTopic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('id, name, topic_embeddings(embedding)')
    .eq('subject_id', subjectId)
  if (error) throw error
  return data.map((t) => {
    const e = t.topic_embeddings as { embedding: string } | { embedding: string }[] | null
    const row = Array.isArray(e) ? e[0] : e
    return { id: t.id, name: t.name, vector: row ? parseVector(row.embedding) : null }
  })
}

/**
 * Topics of imported units (PRD "Teme"): names are matched to the subject's topics (same name, or
 * nearly the same vector), the rest become new topics. AI links of these units are replaced; a
 * link the user set is never touched.
 */
export async function saveImportTopics(
  subjectId: string,
  unitTopics: { unitId: string; names: string[] }[],
): Promise<void> {
  const names = unitTopics.flatMap((u) => u.names)
  const known = await knownTopics(subjectId)
  const unmatched = unmatchedNames(names, known)
  const vectors = new Map<string, number[]>()
  if (unmatched.length > 0 && known.some((t) => t.vector)) {
    try {
      const list = await textVectors(unmatched)
      unmatched.forEach((n, i) => vectors.set(topicKey(n), list[i]!))
    } catch {
      // Without vectors only exact names merge; near-duplicates can be fixed by hand.
    }
  }
  const match = matchTopics(names, known, vectors)

  const created = new Map<string, string>()
  const newTopics: { id: string; subject_id: string; name: string }[] = []
  for (const name of names) {
    const key = topicKey(name)
    if (match.get(key) || created.has(key)) continue
    const id = crypto.randomUUID()
    created.set(key, id)
    newTopics.push({ id, subject_id: subjectId, name: name.replace(/\s+/g, ' ').trim() })
  }
  if (newTopics.length > 0) {
    const { error } = await supabase.from('topics').insert(newTopics)
    if (error) throw error
  }
  const topicId = (name: string) => match.get(topicKey(name)) ?? created.get(topicKey(name))!

  const unitIds = unitTopics.map((u) => u.unitId)
  if (unitIds.length === 0) return
  const { data: existing, error } = await supabase
    .from('unit_topics')
    .select('unit_id, topic_id, assigned_by')
    .in('unit_id', unitIds)
  if (error) throw error
  const has = new Set(existing.map((l) => `${l.unit_id}:${l.topic_id}`))
  const wanted = new Set(unitTopics.flatMap((u) => u.names.map((n) => `${u.unitId}:${topicId(n)}`)))
  const stale = existing.filter(
    (l) => l.assigned_by === 'ai' && !wanted.has(`${l.unit_id}:${l.topic_id}`),
  )
  for (const l of stale) {
    const { error: dError } = await supabase
      .from('unit_topics')
      .delete()
      .eq('unit_id', l.unit_id)
      .eq('topic_id', l.topic_id)
      .eq('assigned_by', 'ai')
    if (dError) throw dError
  }
  const rows = [...wanted]
    .filter((k) => !has.has(k))
    .map((k) => {
      const [unit_id, topic_id] = k.split(':') as [string, string]
      return { unit_id, topic_id, assigned_by: 'ai' as const }
    })
  if (rows.length > 0) {
    const { error: iError } = await supabase.from('unit_topics').insert(rows)
    if (iError) throw iError
  }
}

/** Vectors for what was just saved, in the background (links and dedupe need them). */
export function embedAfterImport() {
  void embedPending().catch(() => undefined)
}

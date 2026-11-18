import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import i18n from '@/app/i18n'
import { undoWindow } from '@/components/toast-store'
import { useAuth } from '@/features/auth/auth-context'
import { embedPending } from '@/features/owl/embeddings'
import { chunkPages } from '@/lib/documents/chunk'
import type { UnitChunk } from '@/lib/sourceText'
import { supabase } from '@/lib/supabase'
import { sourcesKey } from './api'

// Tekst izvora (PRD "Tekst izvora, sažetak i kartice", Sprint 18): passages per unit in
// `source_chunks`; their vectors come later from the EmbedRunner (`unembedded`). Not plan inputs.

const INSERT_ROWS = 500

export const sourceTextKey = (userId: string | undefined, sourceId: string | undefined) =>
  ['sourceText', userId, sourceId] as const

export interface SourceTextStatus {
  passages: number
  /** Passages that already have a vector (searchable by the tutor). */
  embedded: number
  units: number
}

/** How much of a source's text is stored and searchable. */
export function useSourceText(sourceId: string | undefined) {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: sourceTextKey(userId, sourceId),
    enabled: Boolean(userId && sourceId),
    queryFn: async (): Promise<SourceTextStatus> => {
      const [all, embedded, units] = await Promise.all([
        supabase
          .from('source_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('source_id', sourceId!),
        supabase
          .from('source_chunk_embeddings')
          .select('chunk_id, source_chunks!inner(source_id)', { count: 'exact', head: true })
          .eq('source_chunks.source_id', sourceId!),
        supabase
          .from('source_chunks')
          .select('unit_id', { count: 'exact', head: true })
          .eq('source_id', sourceId!)
          .eq('position', 0),
      ])
      for (const r of [all, embedded, units]) if (r.error) throw r.error
      return { passages: all.count ?? 0, embedded: embedded.count ?? 0, units: units.count ?? 0 }
    },
  })
}

async function insertChunks(sourceId: string, chunks: readonly UnitChunk[]) {
  const rows = chunks.map((c) => ({
    id: crypto.randomUUID(),
    source_id: sourceId,
    unit_id: c.unitId,
    page: c.page,
    position: c.position,
    content: c.content,
  }))
  for (let i = 0; i < rows.length; i += INSERT_ROWS) {
    const { error } = await supabase.from('source_chunks').insert(rows.slice(i, i + INSERT_ROWS))
    if (error) throw error
  }
}

/** Embeds the new passages in the background, a run after another while there are any. */
function embedAll() {
  void (async () => {
    for (let run = 0; run < 20 && navigator.onLine; run++)
      if ((await embedPending().catch(() => 0)) === 0) break
  })()
}

function useInvalidate(subjectId: string | undefined, sourceId: string) {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: sourceTextKey(userId, sourceId) })
    void queryClient.invalidateQueries({ queryKey: sourcesKey(userId, subjectId) })
  }
}

/** Replaces the source's text with the passages read from a PDF. */
export function useSaveSourceText(subjectId: string | undefined, sourceId: string) {
  const invalidate = useInvalidate(subjectId, sourceId)
  return useMutation({
    meta: { planInput: false },
    mutationFn: async ({ chunks, pages }: { chunks: UnitChunk[]; pages: number }) => {
      const { error } = await supabase.from('source_chunks').delete().eq('source_id', sourceId)
      if (error) throw error
      await insertChunks(sourceId, chunks)
      const { error: sError } = await supabase
        .from('sources')
        .update({ text_pages: pages, text_read_at: new Date().toISOString() })
        .eq('id', sourceId)
      if (sError) throw sError
      embedAll()
    },
    onSettled: invalidate,
  })
}

/** "Zalijepi tekst poglavlja" (scanned PDF): one unit's text, replacing what it had. */
export function useSaveUnitText(subjectId: string | undefined, sourceId: string) {
  const invalidate = useInvalidate(subjectId, sourceId)
  return useMutation({
    meta: { planInput: false },
    mutationFn: async ({ unitId, page, text }: { unitId: string; page: number; text: string }) => {
      const { error } = await supabase.from('source_chunks').delete().eq('unit_id', unitId)
      if (error) throw error
      const chunks = chunkPages([{ page, text }]).map((c) => ({
        unitId,
        page: c.page,
        position: c.position,
        content: c.content,
      }))
      await insertChunks(sourceId, chunks)
      const { error: sError } = await supabase
        .from('sources')
        .update({ text_read_at: new Date().toISOString() })
        .eq('id', sourceId)
      if (sError) throw sError
      embedAll()
    },
    onSettled: invalidate,
  })
}

/**
 * "Obriši tekst": after the undo toast, the passages and their vectors go; the source and its plan
 * stay. Poništi rejects with `UndoError` (no error toast).
 */
export function useDeleteSourceText(subjectId: string | undefined, sourceId: string) {
  const invalidate = useInvalidate(subjectId, sourceId)
  return useMutation({
    meta: { planInput: false },
    mutationFn: async () => {
      await undoWindow(i18n.t('sources.text.deleted'), i18n.t('common.undo'))
      const { error } = await supabase.from('source_chunks').delete().eq('source_id', sourceId)
      if (error) throw error
      const { error: sError } = await supabase
        .from('sources')
        .update({ text_pages: null, text_read_at: null })
        .eq('id', sourceId)
      if (sError) throw sError
    },
    onSettled: invalidate,
  })
}

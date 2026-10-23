import type {
  EmbedKind,
  EmbedStoreResponse,
  EmbedVectorsResponse,
  SearchNotesResponse,
} from '@shared/schemas.ts'
import { EMBED_ROWS } from '@shared/schemas.ts'
import { supabase } from '@/lib/supabase'
import { invokeAi } from './api'

// gte-small vectors (no LLM, not counted in the AI limit) for everything that has none: new or
// edited units, cards and topics. The database drops a vector when its text changes.

export const PENDING_ROWS = 64
const MAX_CALLS = 40

let running: Promise<number> | null = null

async function pending(): Promise<{ kind: EmbedKind; id: string }[]> {
  const { data, error } = await supabase.rpc('unembedded', { max_rows: PENDING_ROWS })
  if (error) throw error
  return (data ?? []) as { kind: EmbedKind; id: string }[]
}

/** Embeds what is missing, a few rows per call; one run at a time. Returns rows embedded. */
export function embedPending(): Promise<number> {
  running ??= (async () => {
    let total = 0
    // A row the function did not take in this run is left for the next run, never looped on.
    const tried = new Set<string>()
    try {
      for (let calls = 0; calls < MAX_CALLS && navigator.onLine; calls++) {
        const items = (await pending()).filter((r) => !tried.has(r.id)).slice(0, EMBED_ROWS)
        if (items.length === 0) break
        const { done } = await invokeAi<EmbedStoreResponse>('embed', { op: 'store', items })
        for (const r of items) tried.add(r.id)
        total += done.length
      }
    } finally {
      running = null
    }
    return total
  })()
  return running
}

export async function textVectors(texts: string[]): Promise<number[][]> {
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += EMBED_ROWS) {
    const { vectors } = await invokeAi<EmbedVectorsResponse>('embed', {
      op: 'vectors',
      texts: texts.slice(i, i + EMBED_ROWS),
    })
    out.push(...vectors)
  }
  return out
}

export async function searchNotes(query: string) {
  const { matches } = await invokeAi<SearchNotesResponse>('embed', { op: 'search_notes', query })
  return matches
}

/** pgvector text ("[0.1,0.2]") → numbers. */
export function parseVector(v: string | number[]): number[] {
  return typeof v === 'string' ? (JSON.parse(v) as number[]) : v
}

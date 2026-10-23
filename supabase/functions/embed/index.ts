// gte-small vectors of units, cards and topics (question <-> chapter candidates, topic dedupe, the
// notes search). No LLM call, not rate limited. Rows are read and written as the user (RLS).
import { json } from '../_shared/cors.ts'
import { embed } from '../_shared/embed.ts'
import { readJson, serve } from '../_shared/edge.ts'
import type { EdgeContext } from '../_shared/edge.ts'
import { embedText, takeByBudget } from '../_shared/embedText.ts'
import type { EmbedSourceRow } from '../_shared/embedText.ts'
import { embedRequestSchema } from '../_shared/schemas.ts'
import type {
  EmbedKind,
  EmbedStoreResponse,
  EmbedVectorsResponse,
  NoteMatch,
  SearchNotesResponse,
} from '../_shared/schemas.ts'

const NOTE_MATCHES = 8
// gte-small similarities cluster high; below this a note is unrelated.
const MIN_NOTE_SIMILARITY = 0.75

const TABLES: Record<EmbedKind, { table: string; key: string; columns: string }> = {
  unit: { table: 'unit_embeddings', key: 'unit_id', columns: 'id, title, notes' },
  card: { table: 'card_embeddings', key: 'card_id', columns: 'id, front, back' },
  topic: { table: 'topic_embeddings', key: 'topic_id', columns: 'id, name' },
}

async function readRows(ctx: EdgeContext, kind: EmbedKind, ids: string[]) {
  if (ids.length === 0) return []
  const source = { unit: 'units', card: 'cards', topic: 'topics' }[kind]
  const { data, error } = await ctx.db.from(source).select(TABLES[kind].columns).in('id', ids)
  if (error) throw error
  return (data as unknown as Record<string, string | null>[]).map((r): EmbedSourceRow => ({
    kind,
    id: r.id!,
    parts: kind === 'unit' ? [r.title, r.notes] : kind === 'card' ? [r.front, r.back] : [r.name],
  }))
}

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = embedRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const body = parsed.data

    if (body.op === 'vectors') {
      const vectors: number[][] = []
      for (const text of body.texts) vectors.push(JSON.parse(await embed(text)))
      return json({ vectors } satisfies EmbedVectorsResponse)
    }

    if (body.op === 'search_notes') {
      const { data, error } = await ctx.db.rpc('match_notes', {
        query_embedding: await embed(body.query),
        match_count: NOTE_MATCHES,
      })
      if (error) throw error
      const matches = ((data ?? []) as NoteMatch[]).filter(
        (m) => m.similarity >= MIN_NOTE_SIMILARITY,
      )
      return json({ matches } satisfies SearchNotesResponse)
    }

    const ids = (kind: EmbedKind) => body.items.filter((i) => i.kind === kind).map((i) => i.id)
    const found = [
      ...(await readRows(ctx, 'unit', ids('unit'))),
      ...(await readRows(ctx, 'card', ids('card'))),
      ...(await readRows(ctx, 'topic', ids('topic'))),
    ]
    // Rows that are gone (deleted, not the user's) count as done, so the app does not retry them.
    const missing = body.items.filter((i) => !found.some((r) => r.id === i.id)).map((i) => i.id)
    const texts = found.map((r) => ({ row: r, text: embedText(r) }))
    const batch = takeByBudget(texts, (t) => t.text.length)
    const done = [...missing]
    for (const { row, text } of batch) {
      const { table, key } = TABLES[row.kind]
      if (text) {
        const { error } = await ctx.db
          .from(table)
          .upsert({ [key]: row.id, embedding: await embed(text) }, { onConflict: key })
        if (error) throw error
      }
      done.push(row.id)
    }
    return json({ done } satisfies EmbedStoreResponse)
  }),
)

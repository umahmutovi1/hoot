// Embeds document chunks with gte-small and stores them. No LLM call, not rate limited.
// The app sends at most EMBED_BATCH (2) chunks per call to stay inside the CPU limit.
import { json } from '../_shared/cors.ts'
import { embed } from '../_shared/embed.ts'
import { readJson, serve } from '../_shared/edge.ts'
import { embedChunksRequestSchema } from '../_shared/schemas.ts'

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = embedChunksRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const { document_id, chunks } = parsed.data

    const { data: doc } = await ctx.db
      .from('documents')
      .select('id')
      .eq('id', document_id)
      .maybeSingle()
    if (!doc) return json({ error: 'bad_request' }, 404)

    const rows = []
    for (const chunk of chunks) {
      rows.push({ ...chunk, document_id, embedding: await embed(chunk.content) })
    }
    const { error } = await ctx.db.from('document_chunks').upsert(rows, { onConflict: 'id' })
    if (error) throw error
    return json({ stored: rows.length })
  }),
)

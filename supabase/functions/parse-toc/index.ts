// Reads a table of contents (photos or text) into units with difficulty and topics, or rates a
// manual outline ("Procijeni težinu AI-jem"). Nothing is written: the app shows the proposal for
// review and merges it by label. The photos are deleted right after the call.
import { json } from '../_shared/cors.ts'
import { normalizeToc, tocRequest } from '../_shared/contentPrompts.ts'
import { llmDeps, readJson, serve, withUploads } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import { parseTocRequestSchema } from '../_shared/schemas.ts'

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = parseTocRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const body = parsed.data
    return await withUploads(ctx, body.files, 'import', async (files) => {
      const deps = await llmDeps(ctx)
      const result = await generate(deps, tocRequest(body, files))
      return json(normalizeToc(body, result.data))
    })
  }),
)

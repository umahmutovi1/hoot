// Reads a document (pasted text, PDF text layer, image or scanned PDF) and proposes
// academic periods or exams. Nothing is written here: the app shows the proposal for review.
import { json } from '../_shared/cors.ts'
import { llmDeps, readJson, serve } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import type { LlmFile } from '../_shared/llm.ts'
import { normalizeParse, parseRequest, toBase64 } from '../_shared/prompts.ts'
import { parseDocumentRequestSchema } from '../_shared/schemas.ts'

const MAX_FILE_BYTES = 15 * 1024 * 1024

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = parseDocumentRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const body = parsed.data

    const files: LlmFile[] = []
    if (body.file) {
      // Only the caller's own folder; storage RLS enforces the same.
      if (!body.file.path.startsWith(`${ctx.userId}/`)) return json({ error: 'bad_request' }, 400)
      const { data, error } = await ctx.db.storage.from('uploads').download(body.file.path)
      if (error || !data) return json({ error: 'bad_request' }, 400)
      if (data.size > MAX_FILE_BYTES) return json({ error: 'bad_request' }, 413)
      files.push({
        mediaType: body.file.media_type,
        base64: toBase64(new Uint8Array(await data.arrayBuffer())),
      })
    }

    const deps = await llmDeps(ctx)
    const result = await generate(deps, parseRequest(body, files))
    return json(normalizeParse(body, result.data))
  }),
)

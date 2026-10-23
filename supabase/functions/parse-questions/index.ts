// Reads a list of exam questions (photos or text) into questions with topics. Nothing is written:
// the app shows them for review. The photos are deleted right after the call.
import { json } from '../_shared/cors.ts'
import { normalizeQuestions, questionsRequest } from '../_shared/contentPrompts.ts'
import { llmDeps, readJson, serve, withUploads } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import { parseQuestionsRequestSchema } from '../_shared/schemas.ts'

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = parseQuestionsRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const body = parsed.data
    return await withUploads(ctx, body.files, 'import', async (files) => {
      const deps = await llmDeps(ctx)
      const result = await generate(deps, questionsRequest(body, files))
      return json(normalizeQuestions(body, result.data))
    })
  }),
)

// Answers a question from the user's documents (vector search, cited by document and page)
// and from the state summary the app sends (points, exams, calendar).
import { json } from '../_shared/cors.ts'
import { embed } from '../_shared/embed.ts'
import { conversationCache, llmDeps, readJson, serve } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import { answerRequest, citationsFor, normalizeAction } from '../_shared/prompts.ts'
import type { Passage } from '../_shared/prompts.ts'
import { answerRequestSchema } from '../_shared/schemas.ts'
import type { AnswerResponse } from '../_shared/schemas.ts'

const PASSAGES = 6
// gte-small similarities cluster high; below this a passage is noise.
const MIN_SIMILARITY = 0.72

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = answerRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const body = parsed.data

    const deps = await llmDeps(ctx)
    const { data: matches, error } = await ctx.db.rpc('match_document_chunks', {
      query_embedding: await embed(body.question),
      match_count: PASSAGES,
    })
    if (error) throw error
    const passages: Passage[] = (matches ?? [])
      .filter((m: { similarity: number }) => m.similarity >= MIN_SIMILARITY)
      .map((m: Passage) => ({
        document_id: m.document_id,
        title: m.title,
        page: m.page,
        content: m.content,
      }))

    const request = answerRequest(body, passages)
    if (body.conversation_id) request.cache = conversationCache(ctx, body.conversation_id)
    const result = await generate(deps, request)
    const response: AnswerResponse = {
      answer: result.data.answer,
      citations: citationsFor(result.data, passages),
      state_refs: result.data.state_refs,
      ...normalizeAction(result.data),
    }
    return json(response)
  }),
)

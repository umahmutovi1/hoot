// Answers a question from the user's documents (vector search, cited by document and page)
// and from the state summary the app sends (points, exams, calendar). With `stream` the answer
// text comes as server-sent events while it is written ("delta"), then the whole response
// ("done") or the error code ("error").
import { corsHeaders, json } from '../_shared/cors.ts'
import { embed } from '../_shared/embed.ts'
import { conversationCache, llmDeps, readJson, serve } from '../_shared/edge.ts'
import { generate, generateStream, LlmError } from '../_shared/llm.ts'
import { partialStringField } from '../_shared/partialJson.ts'
import { answerRequest, citationsFor, normalizeAction } from '../_shared/prompts.ts'
import type { Passage } from '../_shared/prompts.ts'
import { answerRequestSchema } from '../_shared/schemas.ts'
import type { AnswerOutput, AnswerResponse } from '../_shared/schemas.ts'

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
    const respond = (data: AnswerOutput): AnswerResponse => ({
      answer: data.answer,
      citations: citationsFor(data, passages),
      state_refs: data.state_refs,
      ...normalizeAction(data),
    })
    if (!body.stream) return json(respond((await generate(deps, request)).data))

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) =>
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        // The model writes one JSON object; only the "answer" text goes out while it grows.
        let raw = ''
        let sent = 0
        try {
          const result = await generateStream(deps, request, (delta) => {
            raw += delta
            const answer = partialStringField(raw, 'answer')
            if (answer && answer.length > sent) {
              send('delta', { text: answer.slice(sent) })
              sent = answer.length
            }
          })
          send('done', respond(result.data))
        } catch (err) {
          if (!(err instanceof LlmError)) console.error(err)
          send('error', { error: err instanceof LlmError ? err.code : 'failed' })
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    })
  }),
)

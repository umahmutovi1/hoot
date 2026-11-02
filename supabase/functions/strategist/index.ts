// Sprint 17: rules choose the candidates in the client; the model only selects and explains.
// generate() validates candidate_id and logs every attempt in ai_runs. No blocks are written.
import { json } from '../_shared/cors.ts'
import { llmDeps, readJson, serve } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import { strategistRequestSchema } from '../_shared/schemas.ts'
import { strategistRequest } from '../_shared/strategistPrompt.ts'

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = strategistRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const result = await generate(await llmDeps(ctx), strategistRequest(parsed.data))
    return json(result.data)
  }),
)

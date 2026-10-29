// Classifies calendar events the rules in the app cannot read (docs/CALENDAR-SYNC.md
// "Klasifikacija"): one AI call for up to 50 titles. The answer is stored on the user's own
// events (RLS) only where neither the AI nor the user set a kind yet; ai_runs logs the call.
import { json } from '../_shared/cors.ts'
import { classifiedKinds, classifyRequest } from '../_shared/classifyPrompt.ts'
import { llmDeps, readJson, serve } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import { classifyEventsRequestSchema } from '../_shared/schemas.ts'

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = classifyEventsRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)

    const deps = await llmDeps(ctx)
    const result = await generate(deps, classifyRequest(parsed.data))
    const kinds = classifiedKinds(result.data, parsed.data)
    let classified = 0
    for (const [id, kind] of kinds) {
      const { data, error } = await ctx.db
        .from('external_events')
        .update({ kind, kind_by: 'ai' })
        .eq('id', id)
        .is('kind', null)
        .select('id')
      if (error) throw error
      classified += data?.length ?? 0
    }
    return json({ classified })
  }),
)

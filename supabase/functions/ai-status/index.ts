// Whether AI is configured and how many calls are left; the owl bar is disabled otherwise.
import { json } from '../_shared/cors.ts'
import { remainingRuns, serve } from '../_shared/edge.ts'
import { DAILY_AI_LIMIT, isAiConfigured } from '../_shared/llm.ts'
import type { AiStatus } from '../_shared/schemas.ts'

Deno.serve(
  serve(Deno.env, async (_req, ctx) => {
    const status: AiStatus = {
      enabled: isAiConfigured(ctx.env),
      remaining: await remainingRuns(ctx),
      limit: DAILY_AI_LIMIT,
    }
    return json(status)
  }),
)

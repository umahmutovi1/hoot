// Request plumbing shared by the AI Edge Functions: CORS, auth, error mapping,
// and the rate-limit / ai_runs callbacks for the LLM wrapper.
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { corsHeaders, json } from './cors.ts'
import { DAILY_AI_LIMIT, getProvider, LlmError } from './llm.ts'
import type { LlmDeps, LlmEnv, LlmProvider, PromptCacheStore } from './llm.ts'

export interface EdgeContext {
  userId: string
  /** Acts as the user: RLS applies. */
  db: SupabaseClient
  /** Service role: only for writing ai_runs, which users can read but not write. */
  admin: SupabaseClient
  env: LlmEnv
}

export type EdgeHandler = (req: Request, ctx: EdgeContext) => Promise<Response>

export function serve(env: LlmEnv, handler: EdgeHandler) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    const url = env.get('SUPABASE_URL')
    const anon = env.get('SUPABASE_ANON_KEY')
    const service = env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anon || !service) return json({ error: 'failed' }, 500)

    const authorization = req.headers.get('Authorization') ?? ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized' }, 401)
    const db = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await db.auth.getUser(token)
    if (error || !data.user) return json({ error: 'unauthorized' }, 401)
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    try {
      return await handler(req, { userId: data.user.id, db, admin, env })
    } catch (err) {
      if (err instanceof LlmError) {
        const status =
          err.code === 'rate_limited' || err.code === 'quota_exhausted'
            ? 429
            : err.code === 'no_key'
              ? 503
              : 502
        console.error(err.code, err.message)
        return json({ error: err.code }, status)
      }
      console.error(err)
      return json({ error: 'failed' }, 500)
    }
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** AI calls in the rolling 24 h window (the "30 calls per day" limit). */
export async function countRecentRuns(ctx: EdgeContext): Promise<number> {
  const since = new Date(Date.now() - DAY_MS).toISOString()
  const { count, error } = await ctx.db
    .from('ai_runs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
  if (error) throw error
  return count ?? 0
}

export async function remainingRuns(ctx: EdgeContext): Promise<number> {
  return Math.max(0, DAILY_AI_LIMIT - (await countRecentRuns(ctx)))
}

export async function llmDeps(ctx: EdgeContext): Promise<LlmDeps> {
  const provider: LlmProvider | null = await getProvider(ctx.env)
  if (!provider) throw new LlmError('no_key')
  return {
    provider,
    countRecentRuns: () => countRecentRuns(ctx),
    logRun: async (run) => {
      const { error } = await ctx.admin.from('ai_runs').insert({ ...run, user_id: ctx.userId })
      if (error) console.error('ai_runs insert failed', error.message)
    },
  }
}

/** Prompt cache bookkeeping on the conversation row (RLS: only the user's own). */
export function conversationCache(ctx: EdgeContext, conversationId: string): PromptCacheStore {
  return {
    async lookup(key) {
      const { data } = await ctx.db
        .from('owl_conversations')
        .select('cache_name, cache_key, cache_expires_at')
        .eq('id', conversationId)
        .maybeSingle()
      if (!data || data.cache_key !== key || !data.cache_expires_at) return null
      return new Date(data.cache_expires_at) > new Date() ? (data.cache_name ?? '') : null
    },
    async save(key, name, expiresAt) {
      await ctx.db
        .from('owl_conversations')
        .update({ cache_key: key, cache_name: name, cache_expires_at: expiresAt.toISOString() })
        .eq('id', conversationId)
    },
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

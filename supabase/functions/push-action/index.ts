// push-action (Stage 10c): "Preskoči" on a block reminder, without opening the app. The service
// worker posts the one-time token from the notification; no JWT, the token is the key (only its
// hash is in push_jobs). The block gets skip_requested_at, its unsent jobs ("Kasniš") go, and the
// app applies the same skipBlock() rule as the button when it next opens. Tokens are never logged.
import { createClient } from '@supabase/supabase-js'
import { corsHeaders, json } from '../_shared/cors.ts'
import { ACTION_TTL_MS, hashToken } from '../_shared/push.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) return json({ error: 'not_configured' }, 500)
  let token = ''
  try {
    const body = (await req.json()) as { token?: unknown; action?: unknown }
    if (body.action !== 'skip' || typeof body.token !== 'string') throw new Error('bad')
    token = body.token
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return json({ error: 'unauthorized' }, 401)
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const now = new Date()
    const { data: job, error } = await admin
      .from('push_jobs')
      .select('id, user_id, block_id, sent_at, action_used_at')
      .eq('action_token_hash', await hashToken(token))
      .maybeSingle()
    if (error) return json({ error: 'failed' }, 500)
    if (
      !job ||
      !job.block_id ||
      job.action_used_at ||
      !job.sent_at ||
      now.getTime() - Date.parse(job.sent_at) > ACTION_TTL_MS
    )
      return json({ error: 'unauthorized' }, 401)

    // One use: claim the token first, so a second tap does nothing.
    const { data: claimed, error: cError } = await admin
      .from('push_jobs')
      .update({ action_used_at: now.toISOString() })
      .eq('id', job.id)
      .is('action_used_at', null)
      .select('id')
    if (cError) return json({ error: 'failed' }, 500)
    if (!claimed?.length) return json({ error: 'unauthorized' }, 401)

    const { error: bError } = await admin
      .from('plan_blocks')
      .update({ skip_requested_at: now.toISOString() })
      .eq('id', job.block_id)
      .eq('user_id', job.user_id)
      .eq('status', 'planned')
    if (bError) return json({ error: 'failed' }, 500)
    await admin.from('push_jobs').delete().eq('block_id', job.block_id).is('sent_at', null)
    return json({ ok: true })
  } catch (err) {
    console.error('push-action failed', err instanceof Error ? err.name : typeof err)
    return json({ error: 'failed' }, 500)
  }
})

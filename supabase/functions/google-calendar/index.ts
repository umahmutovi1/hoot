// Google Calendar for the app (docs/CALENDAR-SYNC.md):
//   GET  ?code&state  OAuth callback (Google redirects here): stores the account, creates the
//                     "Hoot" calendar, picks the primary calendar as busy time, starts channels,
//                     then returns to the app (/settings/feeds?google=connected|error).
//   POST {op}         with the user's JWT: auth_url, calendars, select, push, sync, disconnect.
// Tokens stay in calendar_accounts (service role only); nothing here logs a token or a link.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { corsHeaders, json } from '../_shared/cors.ts'
import { readJson } from '../_shared/edge.ts'
import {
  allowedOrigin,
  authUrl,
  exchangeCode,
  GoogleCalendar,
  revokeToken,
  signState,
  verifyState,
} from '../_shared/google.ts'
import {
  ACCOUNT_COLUMNS,
  clientFor,
  ensureChannels,
  ensureHootCalendar,
  errorCode,
  googleCredentials,
  pullAccount,
  pullFeed,
  pushWithLock,
  recordError,
  unwatchCalendar,
  watchCalendar,
  webhookAddress,
  type AccountRow,
} from '../_shared/googleSync.ts'

const STATE_TTL_MS = 10 * 60_000

const requestSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('auth_url'), origin: z.string().max(200) }),
  z.object({ op: z.literal('calendars') }),
  z.object({ op: z.literal('select'), calendar_id: z.string().min(1).max(300), busy: z.boolean() }),
  z.object({ op: z.literal('push') }),
  z.object({ op: z.literal('sync') }),
  z.object({ op: z.literal('disconnect'), delete_calendar: z.boolean() }),
])

const env = { get: (name: string) => Deno.env.get(name) }

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { location: to } })
}

async function accountOf(admin: SupabaseClient, userId: string): Promise<AccountRow | null> {
  const { data } = await admin
    .from('calendar_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()
  return (data as AccountRow | null) ?? null
}

async function callback(req: Request, admin: SupabaseClient, supabaseUrl: string) {
  const creds = googleCredentials(env)
  const params = new URL(req.url).searchParams
  const state = creds ? await verifyState(params.get('state') ?? '', creds.clientSecret) : null
  if (!creds || !state) return json({ error: 'bad_request' }, 400)
  const back = (result: 'connected' | 'error' | 'denied') =>
    redirect(`${state.origin}/settings/feeds?google=${result}`)
  const code = params.get('code')
  if (!code) return back('denied')

  try {
    const tokens = await exchangeCode(creds, code)
    const existing = await accountOf(admin, state.userId)
    const refreshToken = tokens.refreshToken ?? existing?.refresh_token ?? null
    if (!refreshToken) return back('error')
    const gc = new GoogleCalendar(async () => tokens.accessToken)
    const calendars = await gc.listCalendars()
    const primary = calendars.find((c) => c.primary)
    const { data: saved, error } = await admin
      .from('calendar_accounts')
      .upsert(
        {
          user_id: state.userId,
          email: primary?.id ?? null,
          app_origin: state.origin,
          status: 'active',
          last_error: null,
          refresh_token: refreshToken,
          access_token: tokens.accessToken,
          access_expires_at: tokens.expiresAt.toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select(ACCOUNT_COLUMNS)
      .single()
    if (error || !saved) return back('error')
    const account = saved as AccountRow
    const client = clientFor(admin, account, creds)
    await ensureHootCalendar(admin, client, account)

    // Default: the primary calendar is busy time (one less question; it can be switched off).
    const { count } = await admin
      .from('calendar_feeds')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account.id)
    if (!count && primary)
      await admin.from('calendar_feeds').insert({
        user_id: state.userId,
        title: primary.summaryOverride ?? primary.summary ?? 'Google',
        kind: 'busy',
        source: 'google',
        account_id: account.id,
        google_calendar_id: primary.id,
        color: primary.backgroundColor ?? null,
      })
    await ensureChannels(admin, client, account, webhookAddress(supabaseUrl))
    await pullAccount(admin, client, account)
    await pushWithLock(admin, client, account)
    return back('connected')
  } catch (err) {
    console.error('google-calendar callback failed', errorCode(err))
    return back('error')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) return json({ error: 'failed' }, 500)
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (req.method === 'GET') return callback(req, admin, url)
  if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)

  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'unauthorized' }, 401)
  const db = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: user, error: authError } = await db.auth.getUser(token)
  if (authError || !user.user) return json({ error: 'unauthorized' }, 401)
  const userId = user.user.id
  const body = requestSchema.safeParse(await readJson(req))
  if (!body.success) return json({ error: 'bad_request' }, 400)
  const creds = googleCredentials(env)
  if (!creds) return json({ error: 'not_configured' }, 503)
  const op = body.data

  if (op.op === 'auth_url') {
    if (!allowedOrigin(op.origin)) return json({ error: 'bad_request' }, 400)
    const state = await signState(
      { userId, origin: op.origin, exp: Date.now() + STATE_TTL_MS },
      creds.clientSecret,
    )
    return json({ url: authUrl(creds, state) })
  }

  const account = await accountOf(admin, userId)
  if (!account) return json({ error: 'not_connected' }, 409)
  const gc = clientFor(admin, account, creds)

  try {
    switch (op.op) {
      case 'calendars': {
        const [calendars, { data: feeds }] = await Promise.all([
          gc.listCalendars(),
          admin.from('calendar_feeds').select('google_calendar_id').eq('account_id', account.id),
        ])
        const busy = new Set((feeds ?? []).map((f) => f.google_calendar_id as string))
        return json({
          calendars: calendars
            .filter((c) => c.id !== account.hoot_calendar_id && c.accessRole === 'owner')
            .map((c) => ({
              id: c.id,
              title: c.summaryOverride ?? c.summary ?? c.id,
              primary: Boolean(c.primary),
              color: c.backgroundColor ?? null,
              busy: busy.has(c.id),
            })),
        })
      }
      case 'select': {
        if (op.busy) {
          const calendars = await gc.listCalendars()
          const picked = calendars.find((c) => c.id === op.calendar_id && c.accessRole === 'owner')
          if (!picked) return json({ error: 'bad_request' }, 400)
          const { data: feed, error } = await admin
            .from('calendar_feeds')
            .upsert(
              {
                user_id: userId,
                title: picked.summaryOverride ?? picked.summary ?? 'Google',
                kind: 'busy',
                source: 'google',
                account_id: account.id,
                google_calendar_id: picked.id,
                color: picked.backgroundColor ?? null,
              },
              { onConflict: 'account_id,google_calendar_id' },
            )
            .select('id, user_id, kind, busy_only, google_calendar_id')
            .single()
          if (error || !feed) return json({ error: 'failed' }, 500)
          await watchCalendar(admin, gc, account, picked.id, webhookAddress(url))
          await pullFeed(admin, gc, feed as Parameters<typeof pullFeed>[2])
        } else {
          await unwatchCalendar(admin, gc, account.id, op.calendar_id)
          await admin
            .from('calendar_feeds')
            .delete()
            .eq('account_id', account.id)
            .eq('google_calendar_id', op.calendar_id)
        }
        return json({ ok: true })
      }
      case 'push':
        return json({ result: await pushWithLock(admin, gc, account) })
      case 'sync':
        await ensureChannels(admin, gc, account, webhookAddress(url))
        await pullAccount(admin, gc, account)
        return json({ result: await pushWithLock(admin, gc, account) })
      case 'disconnect': {
        const { data: channels } = await admin
          .from('calendar_channels')
          .select('google_calendar_id')
          .eq('account_id', account.id)
        for (const c of channels ?? [])
          await unwatchCalendar(admin, gc, account.id, c.google_calendar_id as string)
        if (op.delete_calendar && account.hoot_calendar_id)
          await gc.deleteCalendar(account.hoot_calendar_id).catch(() => undefined)
        if (account.refresh_token) await revokeToken(account.refresh_token)
        // Cascades to its feeds (and their events), channels and links.
        await admin.from('calendar_accounts').delete().eq('id', account.id)
        await admin.from('calendar_items').delete().eq('user_id', userId)
        return json({ ok: true })
      }
    }
  } catch (err) {
    await recordError(admin, account.id, err)
    const code = errorCode(err)
    console.error('google-calendar failed', op.op, code)
    return json({ error: code === 'invalid_grant' ? 'reconnect' : 'failed' }, 502)
  }
})

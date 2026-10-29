// Server-side Google Calendar sync (docs/CALENDAR-SYNC.md). No user JWT; two callers:
//   - Google push notifications (X-Goog-Channel-ID + X-Goog-Channel-Token): a calendar changed,
//     so that calendar is pulled (busy time, or blocks moved/deleted in Hoot's calendar);
//   - pg_cron (x-cron-secret = CRON_SECRET) every 15 min: renews channels, pulls every account
//     (push notifications can be lost) and pushes the queued items.
// Google gets 200 right away; the work runs after the response (EdgeRuntime.waitUntil).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { json } from '../_shared/cors.ts'
import {
  ACCOUNT_COLUMNS,
  clientFor,
  ensureChannels,
  errorCode,
  googleCredentials,
  pullAccount,
  pullFeed,
  pullHootCalendar,
  pushWithLock,
  recordError,
  webhookAddress,
  type AccountRow,
} from '../_shared/googleSync.ts'

const CRON_BATCH = 30
const env = { get: (name: string) => Deno.env.get(name) }

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

function later(work: Promise<unknown>) {
  const guarded = work.catch((err) => console.error('google-calendar-sync failed', errorCode(err)))
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(guarded)
  return guarded
}

async function onNotification(admin: SupabaseClient, channelId: string, token: string | null) {
  const creds = googleCredentials(env)
  if (!creds) return
  const { data: channel } = await admin
    .from('calendar_channels')
    .select('account_id, google_calendar_id, token')
    .eq('channel_id', channelId)
    .maybeSingle()
  if (!channel || channel.token !== token) return
  const { data } = await admin
    .from('calendar_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('id', channel.account_id)
    .maybeSingle()
  const account = data as AccountRow | null
  if (!account || account.status !== 'active') return
  const gc = clientFor(admin, account, creds)
  try {
    if (channel.google_calendar_id === account.hoot_calendar_id) {
      await pullHootCalendar(admin, gc, account)
      return
    }
    const { data: feed } = await admin
      .from('calendar_feeds')
      .select('id, user_id, kind, busy_only, google_calendar_id')
      .eq('account_id', account.id)
      .eq('google_calendar_id', channel.google_calendar_id)
      .maybeSingle()
    if (feed) await pullFeed(admin, gc, feed as Parameters<typeof pullFeed>[2])
  } catch (err) {
    await recordError(admin, account.id, err)
  }
}

async function onCron(admin: SupabaseClient, supabaseUrl: string) {
  const creds = googleCredentials(env)
  if (!creds) return { synced: 0, failed: 0 }
  const { data } = await admin
    .from('calendar_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('status', 'active')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(CRON_BATCH)
  let synced = 0
  let failed = 0
  for (const account of (data ?? []) as AccountRow[]) {
    const gc = clientFor(admin, account, creds)
    try {
      await ensureChannels(admin, gc, account, webhookAddress(supabaseUrl))
      await pullAccount(admin, gc, account)
      await pushWithLock(admin, gc, account)
      synced++
    } catch (err) {
      await recordError(admin, account.id, err)
      failed++
    }
  }
  return { synced, failed }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) return json({ error: 'failed' }, 500)
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const channelId = req.headers.get('x-goog-channel-id')
  if (channelId) {
    // "sync" is the handshake when a channel starts: nothing changed yet.
    if (req.headers.get('x-goog-resource-state') !== 'sync')
      later(onNotification(admin, channelId, req.headers.get('x-goog-channel-token')))
    return new Response(null, { status: 204 })
  }

  const cronSecret = Deno.env.get('CRON_SECRET')
  const sent = req.headers.get('x-cron-secret')
  if (!cronSecret || !sent || sent !== cronSecret) return json({ error: 'unauthorized' }, 401)
  try {
    return json(await onCron(admin, url))
  } catch (err) {
    console.error('google-calendar-sync cron failed', errorCode(err))
    return json({ error: 'failed' }, 500)
  }
})

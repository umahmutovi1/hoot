// Pulls connected iCal feeds (source 'ics'; Google calendars sync in google-calendar-sync) into external_events (PRD "Povezani kalendari i integracije"): busy
// time and, from Stage 10, deadline feeds (Moodle), whose events the app offers as deadlines.
// No LLM call and no AI limit. Two callers:
//   - the app (user JWT): the user's feeds not synced in the last 30 min, or one feed with force;
//   - pg_cron (header x-cron-secret = CRON_SECRET): every feed not synced in the last 3 h.
// The feed link is a password: it is read with the service role only, never logged, returned or
// written to last_error (which holds an error code).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { corsHeaders, json } from '../_shared/cors.ts'
import { readJson } from '../_shared/edge.ts'
import { replaceFeedEvents } from '../_shared/externalEvents.ts'
import { IcsError, parseIcs } from '../_shared/ics.ts'

const HORIZON_DAYS = 120
const PAST_DAYS = 7
const USER_MIN_INTERVAL_MS = 30 * 60_000
const CRON_MIN_INTERVAL_MS = 3 * 60 * 60_000
const CRON_BATCH = 40
const MAX_BYTES = 5_000_000
const DAY_MS = 86_400_000

const requestSchema = z
  .object({ feed_id: z.uuid().nullish(), force: z.boolean().nullish() })
  .nullable()

interface FeedRow {
  id: string
  user_id: string
  url: string
  kind: string
  busy_only: boolean
  last_synced_at: string | null
}

type SyncError =
  'fetch_failed' | 'http_error' | 'too_large' | 'not_ics' | 'parse_failed' | 'save_failed'

async function download(url: string): Promise<string> {
  const target = url.replace(/^webcal:\/\//i, 'https://')
  let res: Response
  try {
    res = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1' },
    })
  } catch {
    throw 'fetch_failed' satisfies SyncError
  }
  if (!res.ok) throw 'http_error' satisfies SyncError
  const length = Number(res.headers.get('content-length') ?? 0)
  if (length > MAX_BYTES) throw 'too_large' satisfies SyncError
  const text = await res.text()
  if (text.length > MAX_BYTES) throw 'too_large' satisfies SyncError
  return text
}

async function syncFeed(
  admin: SupabaseClient,
  feed: FeedRow,
  timeZone: string,
): Promise<SyncError | null> {
  const now = Date.now()
  let events
  try {
    const text = await download(feed.url)
    events = parseIcs(text, {
      from: new Date(now - PAST_DAYS * DAY_MS),
      to: new Date(now + HORIZON_DAYS * DAY_MS),
      timeZone,
    })
  } catch (err) {
    const code: SyncError =
      err instanceof IcsError
        ? err.code
        : typeof err === 'string'
          ? (err as SyncError)
          : 'fetch_failed'
    await admin
      .from('calendar_feeds')
      .update({ last_error: code, last_synced_at: new Date(now).toISOString() })
      .eq('id', feed.id)
    return code
  }

  if (!(await replaceFeedEvents(admin, feed, events))) return saveFailed(admin, feed.id)
  await admin
    .from('calendar_feeds')
    .update({ last_error: null, last_synced_at: new Date(now).toISOString() })
    .eq('id', feed.id)
  return null
}

async function saveFailed(admin: SupabaseClient, feedId: string): Promise<SyncError> {
  await admin.from('calendar_feeds').update({ last_error: 'save_failed' }).eq('id', feedId)
  return 'save_failed'
}

async function timeZones(admin: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const { data } = await admin.from('profiles').select('id, timezone').in('id', userIds)
  return new Map((data ?? []).map((p) => [p.id as string, p.timezone as string]))
}

async function syncAll(admin: SupabaseClient, feeds: FeedRow[]) {
  const zones = await timeZones(admin, [...new Set(feeds.map((f) => f.user_id))])
  const results: { id: string; error: SyncError | null }[] = []
  for (const feed of feeds)
    results.push({
      id: feed.id,
      error: await syncFeed(admin, feed, zones.get(feed.user_id) ?? 'Europe/Sarajevo'),
    })
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) return json({ error: 'failed' }, 500)
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const columns = 'id, user_id, url, kind, busy_only, last_synced_at'

  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    const sent = req.headers.get('x-cron-secret')
    if (sent) {
      if (!cronSecret || sent !== cronSecret) return json({ error: 'unauthorized' }, 401)
      const before = new Date(Date.now() - CRON_MIN_INTERVAL_MS).toISOString()
      const { data, error } = await admin
        .from('calendar_feeds')
        .select(columns)
        .eq('source', 'ics')
        .or(`last_synced_at.is.null,last_synced_at.lt.${before}`)
        .order('last_synced_at', { ascending: true, nullsFirst: true })
        .limit(CRON_BATCH)
      if (error) return json({ error: 'failed' }, 500)
      const results = await syncAll(admin, data as FeedRow[])
      return json({
        synced: results.filter((r) => !r.error).length,
        failed: results.filter((r) => r.error).length,
      })
    }

    const authorization = req.headers.get('Authorization') ?? ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized' }, 401)
    const db = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: user, error: authError } = await db.auth.getUser(token)
    if (authError || !user.user) return json({ error: 'unauthorized' }, 401)
    const body = requestSchema.safeParse(await readJson(req))
    if (!body.success) return json({ error: 'bad_request' }, 400)

    let query = admin
      .from('calendar_feeds')
      .select(columns)
      .eq('user_id', user.user.id)
      .eq('source', 'ics')
    if (body.data?.feed_id) query = query.eq('id', body.data.feed_id)
    const { data, error } = await query
    if (error) return json({ error: 'failed' }, 500)
    const cutoff = Date.now() - USER_MIN_INTERVAL_MS
    const due = (data as FeedRow[]).filter(
      (f) => body.data?.force || !f.last_synced_at || new Date(f.last_synced_at).getTime() < cutoff,
    )
    const results = await syncAll(admin, due)
    // Feed ids and error codes only; the link never leaves the database.
    return json({ results })
  } catch (err) {
    // Log the kind of failure only: messages from fetch can contain the feed link.
    console.error('sync-calendar failed', err instanceof Error ? err.name : typeof err)
    return json({ error: 'failed' }, 500)
  }
})

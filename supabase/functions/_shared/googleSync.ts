// Server side of the Google Calendar sync (docs/CALENDAR-SYNC.md), used by google-calendar
// (the app's calls and the OAuth callback) and google-calendar-sync (webhooks and cron).
//   pull: picked calendars -> external_events (busy time), Hoot's calendar -> moved/deleted blocks
//   push: calendar_items (computed by the app) -> events in Hoot's calendar
// Tokens are read with the service role only and never logged; errors are stored as codes.
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  blockTimesFromEvent,
  reconcile,
  toBusyRow,
  toEventBody,
  type CalendarItem,
  type CalendarLink,
} from './calendarSync.ts'
import { replaceFeedEvents, type FeedEvent } from './externalEvents.ts'
import {
  GoogleApiError,
  GoogleAuthError,
  GoogleCalendar,
  refreshAccess,
  type GoogleCredentials,
  type GoogleEvent,
} from './google.ts'

const PAST_DAYS = 7
const HORIZON_DAYS = 120
const DAY_MS = 86_400_000
/** Google allows long channels; renew them a day or two before they end. */
const CHANNEL_DAYS = 7
const RENEW_BEFORE_MS = 2 * DAY_MS
const PUSH_LOCK_MS = 90_000

export interface AccountRow {
  id: string
  user_id: string
  email: string | null
  hoot_calendar_id: string | null
  app_origin: string | null
  push_enabled: boolean
  status: string
  refresh_token: string | null
  access_token: string | null
  access_expires_at: string | null
}

export const ACCOUNT_COLUMNS =
  'id, user_id, email, hoot_calendar_id, app_origin, push_enabled, status, refresh_token, access_token, access_expires_at'

interface Profile {
  timezone: string
  day_start_min: number
}

export function googleCredentials(env: { get(name: string): string | undefined }) {
  const clientId = env.get('GOOGLE_CLIENT_ID')
  const clientSecret = env.get('GOOGLE_CLIENT_SECRET')
  const url = env.get('SUPABASE_URL')
  if (!clientId || !clientSecret || !url) return null
  return {
    clientId,
    clientSecret,
    redirectUri: `${url}/functions/v1/google-calendar`,
  } satisfies GoogleCredentials
}

export const webhookAddress = (supabaseUrl: string) =>
  `${supabaseUrl}/functions/v1/google-calendar-sync`

async function setError(admin: SupabaseClient, accountId: string, code: string | null) {
  await admin
    .from('calendar_accounts')
    .update(
      code === 'invalid_grant' ? { status: 'reconnect', last_error: code } : { last_error: code },
    )
    .eq('id', accountId)
}

/** A Calendar client that refreshes and stores the access token; `invalid_grant` = reconnect. */
export function clientFor(admin: SupabaseClient, account: AccountRow, creds: GoogleCredentials) {
  let token = account.access_token
  let expires = account.access_expires_at ? Date.parse(account.access_expires_at) : 0
  return new GoogleCalendar(async () => {
    if (token && expires - Date.now() > 60_000) return token
    if (!account.refresh_token) throw new GoogleAuthError('invalid_grant')
    try {
      const fresh = await refreshAccess(creds, account.refresh_token)
      token = fresh.accessToken
      expires = fresh.expiresAt.getTime()
      await admin
        .from('calendar_accounts')
        .update({
          access_token: token,
          access_expires_at: fresh.expiresAt.toISOString(),
          ...(fresh.refreshToken ? { refresh_token: fresh.refreshToken } : {}),
        })
        .eq('id', account.id)
      return token
    } catch (err) {
      if (err instanceof GoogleAuthError && err.code === 'invalid_grant')
        await setError(admin, account.id, 'invalid_grant')
      throw err
    }
  })
}

async function profileOf(admin: SupabaseClient, userId: string): Promise<Profile> {
  const { data } = await admin
    .from('profiles')
    .select('timezone, day_start_min')
    .eq('id', userId)
    .maybeSingle()
  return {
    timezone: (data?.timezone as string | undefined) ?? 'Europe/Sarajevo',
    day_start_min: (data?.day_start_min as number | undefined) ?? 240,
  }
}

/** Hoot's own calendar ("Hoot"), created on connect or again when the user deleted it. */
export async function ensureHootCalendar(
  admin: SupabaseClient,
  gc: GoogleCalendar,
  account: AccountRow,
): Promise<string> {
  if (account.hoot_calendar_id && (await gc.calendarExists(account.hoot_calendar_id)))
    return account.hoot_calendar_id
  const { timezone } = await profileOf(admin, account.user_id)
  const { id } = await gc.createCalendar('Hoot', timezone)
  await admin.from('calendar_accounts').update({ hoot_calendar_id: id }).eq('id', account.id)
  // A new calendar has none of the old events: every item is written again.
  await admin.from('calendar_links').delete().eq('account_id', account.id)
  account.hoot_calendar_id = id
  return id
}

const windowOf = () => {
  const now = Date.now()
  return { from: new Date(now - PAST_DAYS * DAY_MS), to: new Date(now + HORIZON_DAYS * DAY_MS) }
}

/** A picked calendar's events as busy time, the same way as an iCal feed. */
export async function pullFeed(
  admin: SupabaseClient,
  gc: GoogleCalendar,
  feed: {
    id: string
    user_id: string
    kind: string
    busy_only: boolean
    google_calendar_id: string
  },
): Promise<boolean> {
  const { from, to } = windowOf()
  const events = await gc.listEvents(feed.google_calendar_id, from, to)
  const rows = events.map(toBusyRow).filter((r): r is FeedEvent => r !== null)
  const ok = await replaceFeedEvents(admin, feed, rows)
  await admin
    .from('calendar_feeds')
    .update({ last_synced_at: new Date().toISOString(), last_error: ok ? null : 'save_failed' })
    .eq('id', feed.id)
  return ok
}

/**
 * Changes the user made in Hoot's calendar. A moved block becomes a manual block at the new time
 * (as moving it in the app); a deleted one is skipped through `skip_requested_at`, which the app
 * applies like "Preskoči" (material goes to the plan from tomorrow). Exams, deadlines and classes
 * follow Hoot: their event is written again on the next push.
 */
export async function pullHootCalendar(
  admin: SupabaseClient,
  gc: GoogleCalendar,
  account: AccountRow,
): Promise<void> {
  if (!account.hoot_calendar_id) return
  const { from, to } = windowOf()
  const events = await gc.listEvents(account.hoot_calendar_id, from, to)
  const byId = new Map(events.map((e) => [e.id, e]))
  const { data } = await admin
    .from('calendar_links')
    .select('id, google_event_id, item_key, kind, ref_id, pushed_hash, pushed_start, etag, state')
    .eq('account_id', account.id)
  const links = (data ?? []) as (CalendarLink & { ref_id: string | null })[]
  const profile = await profileOf(admin, account.user_id)
  const boundary = { timeZone: profile.timezone, dayStartMin: profile.day_start_min }

  for (const link of links) {
    if (link.state !== 'ok') continue
    const event = byId.get(link.google_event_id)
    // Only events in the window can be judged; an older one is simply not listed.
    const start = link.pushed_start ? Date.parse(link.pushed_start) : NaN
    const inWindow = !Number.isNaN(start) && start >= from.getTime() && start <= to.getTime()
    if (!event || event.status === 'cancelled') {
      if (!inWindow && !event) continue
      await onDeleted(admin, link)
      continue
    }
    if (event.etag && event.etag === link.etag) continue
    await onChanged(admin, link, event, boundary)
  }
}

async function onDeleted(admin: SupabaseClient, link: CalendarLink & { ref_id: string | null }) {
  if (link.kind === 'block' && link.ref_id)
    await admin
      .from('plan_blocks')
      .update({ skip_requested_at: new Date().toISOString() })
      .eq('id', link.ref_id)
      .eq('status', 'planned')
  if (link.kind === 'block')
    await admin.from('calendar_links').update({ state: 'deleted' }).eq('id', link.id)
  // Exams, deadlines, classes: forget the event, the next push writes it again.
  else await admin.from('calendar_links').delete().eq('id', link.id)
}

async function onChanged(
  admin: SupabaseClient,
  link: CalendarLink & { ref_id: string | null },
  event: GoogleEvent,
  boundary: { timeZone: string; dayStartMin: number },
) {
  const times = link.kind === 'block' ? blockTimesFromEvent(event, boundary) : null
  if (
    times &&
    link.ref_id &&
    Date.parse(times.planned_start) !== Date.parse(link.pushed_start ?? '')
  ) {
    const { data: block } = await admin
      .from('plan_blocks')
      .select('id, status, origin, reason')
      .eq('id', link.ref_id)
      .maybeSingle()
    if (block && block.status === 'planned') {
      let mode = 'reading'
      try {
        const reason = JSON.parse((block.reason as string | null) ?? 'null') as {
          mode?: string
        } | null
        if (reason?.mode) mode = reason.mode
      } catch {
        // an AI reason without a mode
      }
      await admin
        .from('plan_blocks')
        .update({
          ...times,
          origin: 'user',
          plan_run_id: null,
          // "Vrati predloženo" brings an AI block back, as for a block moved in the app.
          reason:
            block.origin === 'ai'
              ? JSON.stringify({ code: 'manual', mode, edited: true })
              : block.reason,
        })
        .eq('id', link.ref_id)
    }
    await admin
      .from('calendar_links')
      .update({ etag: event.etag ?? null, pushed_start: times.planned_start })
      .eq('id', link.id)
    return
  }
  // Anything else (a title, an exam's date): Hoot's version is written back on the next push.
  await admin
    .from('calendar_links')
    .update({ etag: event.etag ?? null, pushed_hash: null })
    .eq('id', link.id)
}

/** Writes the wanted items into Hoot's calendar (nothing when push is off: its events go). */
export async function pushAccount(
  admin: SupabaseClient,
  gc: GoogleCalendar,
  account: AccountRow,
): Promise<void> {
  const calendarId = await ensureHootCalendar(admin, gc, account)
  const { timezone } = await profileOf(admin, account.user_id)
  const [{ data: itemRows }, { data: linkRows }] = await Promise.all([
    admin
      .from('calendar_items')
      .select(
        'key, kind, ref_id, starts_at, ends_at, all_day, title, description, url_path, color, hash',
      )
      .eq('user_id', account.user_id),
    admin
      .from('calendar_links')
      .select('id, google_event_id, item_key, kind, pushed_hash, pushed_start, etag, state')
      .eq('account_id', account.id),
  ])
  const items = account.push_enabled ? ((itemRows ?? []) as CalendarItem[]) : []
  const plan = reconcile(items, (linkRows ?? []) as CalendarLink[])
  const pushed = (item: CalendarItem, event: GoogleEvent) => ({
    item_key: item.key,
    kind: item.kind,
    ref_id: item.ref_id,
    pushed_hash: item.hash,
    pushed_start: item.starts_at,
    etag: event.etag ?? null,
    state: 'ok',
  })

  for (const { link, remote } of plan.remove) {
    if (remote) await gc.deleteEvent(calendarId, link.google_event_id)
    await admin.from('calendar_links').delete().eq('id', link.id)
  }
  for (const { item, link } of plan.patch) {
    try {
      const event = await gc.patchEvent(
        calendarId,
        link.google_event_id,
        toEventBody(item, account.app_origin, timezone),
      )
      await admin.from('calendar_links').update(pushed(item, event)).eq('id', link.id)
    } catch (err) {
      // Deleted in Google meanwhile: write it as a new event.
      if (!(err instanceof GoogleApiError) || (err.status !== 404 && err.status !== 410)) throw err
      await admin.from('calendar_links').delete().eq('id', link.id)
      plan.insert.push(item)
    }
  }
  for (const item of plan.insert) {
    // A link that was 'deleted' for this key goes first (unique item_key).
    await admin
      .from('calendar_links')
      .delete()
      .eq('account_id', account.id)
      .eq('item_key', item.key)
    const event = await gc.insertEvent(calendarId, toEventBody(item, account.app_origin, timezone))
    await admin.from('calendar_links').insert({
      user_id: account.user_id,
      account_id: account.id,
      google_calendar_id: calendarId,
      google_event_id: event.id,
      ...pushed(item, event),
    })
  }
  await admin
    .from('calendar_accounts')
    .update({ last_pushed_at: new Date().toISOString(), last_error: null })
    .eq('id', account.id)
}

/**
 * Push with a lock per account: a push asked while one runs is recorded and run right after, so a
 * burst of app writes ends in one up-to-date state.
 */
export async function pushWithLock(
  admin: SupabaseClient,
  gc: GoogleCalendar,
  account: AccountRow,
): Promise<'pushed' | 'queued'> {
  const now = new Date()
  const { data: locked } = await admin
    .from('calendar_accounts')
    .update({ push_lock_until: new Date(now.getTime() + PUSH_LOCK_MS).toISOString() })
    .eq('id', account.id)
    .or(`push_lock_until.is.null,push_lock_until.lt.${now.toISOString()}`)
    .select('id')
  if (!locked?.length) {
    await admin
      .from('calendar_accounts')
      .update({ push_requested_at: now.toISOString() })
      .eq('id', account.id)
    return 'queued'
  }
  try {
    for (let round = 0; round < 3; round++) {
      const started = new Date().toISOString()
      await pushAccount(admin, gc, account)
      const { data } = await admin
        .from('calendar_accounts')
        .select('push_requested_at, push_enabled')
        .eq('id', account.id)
        .maybeSingle()
      if (!data?.push_requested_at || data.push_requested_at < started) break
      account.push_enabled = data.push_enabled as boolean
    }
  } finally {
    await admin
      .from('calendar_accounts')
      .update({ push_lock_until: null, push_requested_at: null })
      .eq('id', account.id)
  }
  return 'pushed'
}

/** Starts (or restarts) the push channel of one calendar. */
export async function watchCalendar(
  admin: SupabaseClient,
  gc: GoogleCalendar,
  account: AccountRow,
  calendarId: string,
  address: string,
): Promise<void> {
  const { data: old } = await admin
    .from('calendar_channels')
    .select('id, channel_id, resource_id')
    .eq('account_id', account.id)
    .eq('google_calendar_id', calendarId)
  const id = crypto.randomUUID()
  const token = crypto.randomUUID()
  const expiration = Date.now() + CHANNEL_DAYS * DAY_MS
  const channel = await gc.watchEvents(calendarId, { id, token, address, expiration })
  await admin.from('calendar_channels').insert({
    user_id: account.user_id,
    account_id: account.id,
    google_calendar_id: calendarId,
    channel_id: id,
    resource_id: channel.resourceId,
    token,
    expires_at: new Date(Number(channel.expiration ?? expiration)).toISOString(),
  })
  for (const c of old ?? []) {
    await gc.stopChannel(c.channel_id as string, c.resource_id as string)
    await admin.from('calendar_channels').delete().eq('id', c.id)
  }
}

export async function unwatchCalendar(
  admin: SupabaseClient,
  gc: GoogleCalendar,
  accountId: string,
  calendarId: string,
) {
  const { data } = await admin
    .from('calendar_channels')
    .select('id, channel_id, resource_id')
    .eq('account_id', accountId)
    .eq('google_calendar_id', calendarId)
  for (const c of data ?? []) {
    await gc.stopChannel(c.channel_id as string, c.resource_id as string)
    await admin.from('calendar_channels').delete().eq('id', c.id)
  }
}

/** Channels for Hoot's calendar and every picked one; old or missing ones are renewed. */
export async function ensureChannels(
  admin: SupabaseClient,
  gc: GoogleCalendar,
  account: AccountRow,
  address: string,
): Promise<void> {
  const [{ data: feeds }, { data: channels }] = await Promise.all([
    admin
      .from('calendar_feeds')
      .select('google_calendar_id')
      .eq('account_id', account.id)
      .eq('source', 'google'),
    admin
      .from('calendar_channels')
      .select('google_calendar_id, expires_at')
      .eq('account_id', account.id),
  ])
  const wanted = new Set<string>(
    [account.hoot_calendar_id, ...(feeds ?? []).map((f) => f.google_calendar_id as string)].filter(
      (c): c is string => Boolean(c),
    ),
  )
  const fresh = new Set(
    (channels ?? [])
      .filter((c) => Date.parse(c.expires_at as string) - Date.now() > RENEW_BEFORE_MS)
      .map((c) => c.google_calendar_id as string),
  )
  for (const calendarId of wanted)
    if (!fresh.has(calendarId)) await watchCalendar(admin, gc, account, calendarId, address)
  for (const c of channels ?? [])
    if (!wanted.has(c.google_calendar_id as string))
      await unwatchCalendar(admin, gc, account.id, c.google_calendar_id as string)
}

/** Every picked calendar and Hoot's own: busy time in, moved blocks back. */
export async function pullAccount(
  admin: SupabaseClient,
  gc: GoogleCalendar,
  account: AccountRow,
): Promise<void> {
  const { data: feeds } = await admin
    .from('calendar_feeds')
    .select('id, user_id, kind, busy_only, google_calendar_id')
    .eq('account_id', account.id)
    .eq('source', 'google')
  for (const feed of feeds ?? []) await pullFeed(admin, gc, feed as Parameters<typeof pullFeed>[2])
  await pullHootCalendar(admin, gc, account)
  await admin
    .from('calendar_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', account.id)
}

/** The code stored on the account for a failed sync (never a message: it can hold a token). */
export function errorCode(err: unknown): string {
  if (err instanceof GoogleAuthError) return err.code
  if (err instanceof GoogleApiError) return `google_${err.status}`
  return 'failed'
}

export async function recordError(admin: SupabaseClient, accountId: string, err: unknown) {
  await setError(admin, accountId, errorCode(err))
}

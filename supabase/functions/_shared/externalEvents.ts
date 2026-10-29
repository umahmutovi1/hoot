// Writing a feed's events into external_events, shared by iCal (sync-calendar) and Google
// (google-calendar-sync) feeds: the feed's full set of events in the window replaces the stored one.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FeedEvent {
  uid: string
  startsAt: Date
  endsAt: Date
  allDay: boolean
  title: string | null
  location: string | null
  category: string | null
}

export interface FeedRef {
  id: string
  user_id: string
  kind: string
  busy_only: boolean
}

/** Upserts the events and deletes the ones that are gone; false when a write failed. */
export async function replaceFeedEvents(
  admin: SupabaseClient,
  feed: FeedRef,
  events: FeedEvent[],
): Promise<boolean> {
  const rows = events.map((e) => ({
    user_id: feed.user_id,
    feed_id: feed.id,
    uid: e.uid.slice(0, 500),
    starts_at: e.startsAt.toISOString(),
    ends_at: e.endsAt.toISOString(),
    all_day: e.allDay,
    title: feed.busy_only ? null : (e.title?.slice(0, 300) ?? null),
    location: feed.busy_only ? null : (e.location?.slice(0, 300) ?? null),
    category: feed.busy_only ? null : (e.category?.slice(0, 300) ?? null),
  }))
  const key = (r: { uid: string; starts_at: string }) =>
    `${r.uid}|${new Date(r.starts_at).toISOString()}`
  const keep = new Set(rows.map(key))

  const { data: existing, error: readError } = await admin
    .from('external_events')
    .select('id, uid, starts_at, deadline_id, ignored')
    .eq('feed_id', feed.id)
  if (readError) return false
  // `ignored` and `deadline_id` are not in the upsert, so "ignoriši" and an imported deadline
  // survive every sync. A Moodle due date that moved is a new row (the start is in the key):
  // it keeps its event's deadline and skip, so the app shows it as changed, not new.
  const linked = new Map<string, { deadline_id: string | null; ignored: boolean }>()
  for (const r of existing ?? [])
    if (r.deadline_id || r.ignored)
      linked.set(r.uid, { deadline_id: r.deadline_id, ignored: r.ignored })
  const plain = rows.filter((r) => feed.kind !== 'deadlines' || !linked.has(r.uid))
  const carried = rows
    .filter((r) => feed.kind === 'deadlines' && linked.has(r.uid))
    .map((r) => ({ ...r, ...linked.get(r.uid)! }))
  for (const batch of [plain, carried])
    for (let i = 0; i < batch.length; i += 500) {
      const { error } = await admin
        .from('external_events')
        .upsert(batch.slice(i, i + 500), { onConflict: 'feed_id,uid,starts_at' })
      if (error) return false
    }
  const gone = (existing ?? []).filter((r) => !keep.has(key(r))).map((r) => r.id)
  for (let i = 0; i < gone.length; i += 200) {
    const { error } = await admin
      .from('external_events')
      .delete()
      .in('id', gone.slice(i, i + 200))
    if (error) return false
  }
  return true
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import type { CalendarEvent, CalendarFeed } from '@/lib/schedule'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

// Connected calendars (PRD "Povezani kalendari i integracije"). The secret link is written but
// never read back: the app selects `url_hint`, and the column grants in 0015 forbid `url`.
// Nothing here keeps the link in the query cache, logs or error messages.

const FEED_COLUMNS =
  'id, title, url_hint, kind, color, all_day_busy, busy_only, last_synced_at, last_error, created_at, updated_at'
const EVENT_COLUMNS =
  'id, feed_id, uid, starts_at, ends_at, all_day, title, location, ignored, category, deadline_id'

export type FeedRow = Pick<
  Tables<'calendar_feeds'>,
  | 'id'
  | 'title'
  | 'url_hint'
  | 'kind'
  | 'color'
  | 'all_day_busy'
  | 'busy_only'
  | 'last_synced_at'
  | 'last_error'
  | 'created_at'
  | 'updated_at'
>
export type EventRow = Pick<
  Tables<'external_events'>,
  | 'id'
  | 'feed_id'
  | 'uid'
  | 'starts_at'
  | 'ends_at'
  | 'all_day'
  | 'title'
  | 'location'
  | 'ignored'
  | 'category'
  | 'deadline_id'
>

export const feedsKey = (userId: string | undefined) => ['calendar_feeds', userId] as const
export const eventsKey = (userId: string | undefined) => ['external_events', userId] as const

function useUserId() {
  return useAuth().session?.user.id
}

export function useCalendarFeeds() {
  const userId = useUserId()
  return useQuery({
    queryKey: feedsKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<FeedRow[]> => {
      const { data, error } = await supabase
        .from('calendar_feeds')
        .select(FEED_COLUMNS)
        .order('created_at')
      if (error) throw error
      return data as FeedRow[]
    },
  })
}

/** Events of all feeds (the sync keeps 7 days back and 120 ahead). */
export function useExternalEvents() {
  const userId = useUserId()
  return useQuery({
    queryKey: eventsKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from('external_events')
        .select(EVENT_COLUMNS)
        .order('starts_at')
        .limit(5000)
      if (error) throw error
      return data as EventRow[]
    },
  })
}

export const toFeed = (row: FeedRow): CalendarFeed => ({
  id: row.id,
  kind: row.kind as CalendarFeed['kind'],
  allDayBusy: row.all_day_busy,
})

export const toEvent = (row: EventRow): CalendarEvent => ({
  id: row.id,
  feedId: row.feed_id,
  startsAt: new Date(row.starts_at),
  endsAt: new Date(row.ends_at),
  allDay: row.all_day,
  ignored: row.ignored,
  title: row.title,
})

export type SyncError =
  'fetch_failed' | 'http_error' | 'too_large' | 'not_ics' | 'parse_failed' | 'save_failed'

interface SyncResult {
  results: { id: string; error: SyncError | null }[]
}

/** Runs `sync-calendar` for the user's feeds (only the ones not synced in 30 min unless forced). */
export async function syncCalendars(body: { feed_id?: string; force?: boolean } = {}) {
  const { data, error } = await supabase.functions.invoke<SyncResult>('sync-calendar', {
    method: 'POST',
    body,
  })
  if (error) throw new Error('sync_failed')
  return data
}

export function useSyncCalendars() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: syncCalendars,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: feedsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: eventsKey(userId) }),
      ]),
  })
}

export interface NewFeed {
  title: string
  url: string
  kind: 'busy' | 'deadlines'
  busy_only: boolean
  all_day_busy: boolean
}

/** Adds a feed and syncs it right away; the link only goes into the insert. */
export function useAddFeed() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (feed: NewFeed) => {
      const id = crypto.randomUUID()
      const { error } = await supabase.from('calendar_feeds').insert({ id, ...feed })
      if (error) throw new Error('save_failed')
      return syncCalendars({ feed_id: id, force: true })
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: feedsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: eventsKey(userId) }),
      ]),
  })
}

export function useUpdateFeed() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<FeedRow, 'title' | 'busy_only' | 'all_day_busy'>> & { url?: string }
    }) => {
      const { error } = await supabase.from('calendar_feeds').update(patch).eq('id', id)
      if (error) throw new Error('save_failed')
      // A new link or "samo zauzeto" changes what is stored: sync again.
      if (patch.url !== undefined || patch.busy_only !== undefined)
        await syncCalendars({ feed_id: id, force: true })
    },
    onMutate: ({ id, patch }) => {
      const { url: _url, ...visible } = patch
      queryClient.setQueryData<FeedRow[]>(feedsKey(userId), (old) =>
        old?.map((f) => (f.id === id ? { ...f, ...visible } : f)),
      )
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: feedsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: eventsKey(userId) }),
      ]),
  })
}

export function useDeleteFeed() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_feeds').delete().eq('id', id)
      if (error) throw new Error('delete_failed')
    },
    onMutate: (id) => {
      queryClient.setQueryData<FeedRow[]>(feedsKey(userId), (old) =>
        old?.filter((f) => f.id !== id),
      )
      queryClient.setQueryData<EventRow[]>(eventsKey(userId), (old) =>
        old?.filter((e) => e.feed_id !== id),
      )
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: feedsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: eventsKey(userId) }),
      ]),
  })
}

/** "Ignoriši" one event (kept across syncs) or bring it back. */
export function useIgnoreEvent() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ignored }: { id: string; ignored: boolean }) => {
      const { error } = await supabase.from('external_events').update({ ignored }).eq('id', id)
      if (error) throw new Error('save_failed')
    },
    onMutate: ({ id, ignored }) => {
      queryClient.setQueryData<EventRow[]>(eventsKey(userId), (old) =>
        old?.map((e) => (e.id === id ? { ...e, ignored } : e)),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: eventsKey(userId) }),
  })
}

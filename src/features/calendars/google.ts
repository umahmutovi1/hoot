import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { eventsKey, feedsKey } from './api'

// Google Calendar (docs/CALENDAR-SYNC.md): the account, the items Hoot writes into its Google
// calendar and the links that say which of them are already there. Tokens never reach the app.

export type GoogleAccount = Pick<
  Tables<'calendar_accounts'>,
  | 'id'
  | 'email'
  | 'hoot_calendar_id'
  | 'push_enabled'
  | 'status'
  | 'last_error'
  | 'last_synced_at'
  | 'last_pushed_at'
>

const ACCOUNT_COLUMNS =
  'id, email, hoot_calendar_id, push_enabled, status, last_error, last_synced_at, last_pushed_at'

export const googleAccountKey = (userId: string | undefined) =>
  ['calendar_accounts', userId] as const
export const calendarItemsKey = (userId: string | undefined) => ['calendar_items', userId] as const
export const calendarLinksKey = (userId: string | undefined) => ['calendar_links', userId] as const
const googleCalendarsKey = (userId: string | undefined) => ['google_calendars', userId] as const

const useUserId = () => useAuth().session?.user.id

export function useGoogleAccount() {
  const userId = useUserId()
  return useQuery({
    queryKey: googleAccountKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<GoogleAccount | null> => {
      const { data, error } = await supabase
        .from('calendar_accounts')
        .select(ACCOUNT_COLUMNS)
        .maybeSingle()
      if (error) throw error
      return data as GoogleAccount | null
    },
  })
}

export interface StoredItem {
  key: string
  hash: string
  starts_at: string
}

export function useStoredItems(enabled: boolean) {
  const userId = useUserId()
  return useQuery({
    queryKey: calendarItemsKey(userId),
    enabled: Boolean(userId) && enabled,
    queryFn: async (): Promise<StoredItem[]> => {
      const { data, error } = await supabase
        .from('calendar_items')
        .select('key, hash, starts_at')
        .limit(5000)
      if (error) throw error
      return data
    },
  })
}

export interface LinkRow {
  item_key: string | null
  pushed_hash: string | null
  state: string
}

export function useCalendarLinks(enabled: boolean) {
  const userId = useUserId()
  return useQuery({
    queryKey: calendarLinksKey(userId),
    enabled: Boolean(userId) && enabled,
    queryFn: async (): Promise<LinkRow[]> => {
      const { data, error } = await supabase
        .from('calendar_links')
        .select('item_key, pushed_hash, state')
        .limit(5000)
      if (error) throw error
      return data
    },
  })
}

export type GoogleOp =
  | { op: 'auth_url'; origin: string }
  | { op: 'calendars' }
  | { op: 'select'; calendar_id: string; busy: boolean }
  | { op: 'push' }
  | { op: 'sync' }
  | { op: 'disconnect'; delete_calendar: boolean }

export async function googleCall<T = unknown>(body: GoogleOp): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('google-calendar', {
    method: 'POST',
    body,
  })
  if (error) throw new Error('google_failed')
  return data as T
}

/** "Poveži Google kalendar": Google's consent screen, then back to /settings/feeds. */
export async function connectGoogle() {
  const { url } = await googleCall<{ url: string }>({
    op: 'auth_url',
    origin: window.location.origin,
  })
  window.location.assign(url)
}

export interface GoogleCalendarRow {
  id: string
  title: string
  primary: boolean
  color: string | null
  busy: boolean
}

export function useGoogleCalendars(enabled: boolean) {
  const userId = useUserId()
  return useQuery({
    queryKey: googleCalendarsKey(userId),
    enabled: Boolean(userId) && enabled,
    queryFn: async () =>
      (await googleCall<{ calendars: GoogleCalendarRow[] }>({ op: 'calendars' })).calendars,
  })
}

function useInvalidateGoogle() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      [
        googleAccountKey(userId),
        googleCalendarsKey(userId),
        calendarLinksKey(userId),
        calendarItemsKey(userId),
        feedsKey(userId),
        eventsKey(userId),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )
}

export function useSelectGoogleCalendar() {
  const invalidate = useInvalidateGoogle()
  return useMutation({
    mutationFn: (v: { calendar_id: string; busy: boolean }) => googleCall({ op: 'select', ...v }),
    onSettled: invalidate,
  })
}

export function useGoogleSync() {
  const invalidate = useInvalidateGoogle()
  return useMutation({
    mutationFn: () => googleCall({ op: 'sync' }),
    onSettled: invalidate,
  })
}

export function useSetGooglePush() {
  const invalidate = useInvalidateGoogle()
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('calendar_accounts')
        .update({ push_enabled: enabled })
        .eq('id', id)
      if (error) throw error
      await googleCall({ op: 'push' })
    },
    onSettled: invalidate,
  })
}

export function useDisconnectGoogle() {
  const invalidate = useInvalidateGoogle()
  return useMutation({
    mutationFn: (deleteCalendar: boolean) =>
      googleCall({ op: 'disconnect', delete_calendar: deleteCalendar }),
    onSettled: invalidate,
  })
}

export type SyncState = 'synced' | 'pending' | null

/** "u Google-u" / "čeka" for an item key; null when it is not meant for Google. */
export function syncStateOf(
  key: string,
  items: Map<string, string>,
  links: Map<string, LinkRow>,
): SyncState {
  const hash = items.get(key)
  if (!hash) return null
  const link = links.get(key)
  return link && link.state === 'ok' && link.pushed_hash === hash ? 'synced' : 'pending'
}

/**
 * Sync state for the Plan: whether Google is connected, how many items wait, and the state of one
 * item ("block:<id>").
 */
export function useGoogleSyncStatus() {
  const { data: account } = useGoogleAccount()
  const active = Boolean(account && account.status === 'active' && account.push_enabled)
  const items = useStoredItems(active).data
  const links = useCalendarLinks(active).data
  return useMemo(() => {
    const itemMap = new Map((items ?? []).map((i) => [i.key, i.hash]))
    const linkMap = new Map(
      (links ?? []).filter((l) => l.item_key).map((l) => [l.item_key!, l] as const),
    )
    let pending = 0
    for (const key of itemMap.keys())
      if (syncStateOf(key, itemMap, linkMap) === 'pending') pending++
    return {
      account: account ?? null,
      active,
      pending,
      stateOf: (key: string): SyncState => (active ? syncStateOf(key, itemMap, linkMap) : null),
    }
  }, [account, active, items, links])
}

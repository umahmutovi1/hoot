// Pure logic of the Google Calendar sync (docs/CALENDAR-SYNC.md), shared by the app (`@shared/`)
// and the google-calendar functions: item hash, item -> Google event, reconciling the wanted
// items with the events Hoot already wrote, Google event -> busy row, and a moved block's time.
import type { GoogleEvent, GoogleEventBody } from './google.ts'

export type CalendarItemKind = 'block' | 'exam' | 'deadline' | 'class'

/** A `calendar_items` row: one thing Hoot wants in its Google calendar. */
export interface CalendarItem {
  key: string
  kind: CalendarItemKind
  ref_id: string
  starts_at: string
  ends_at: string
  all_day: boolean
  title: string
  description: string | null
  url_path: string | null
  /** Subject color as hex, for the nearest Google event color. */
  color: string | null
  hash: string
}

/** A `calendar_links` row: a Google event Hoot wrote, and the item it shows. */
export interface CalendarLink {
  id: string
  google_event_id: string
  item_key: string | null
  kind: string
  pushed_hash: string | null
  pushed_start: string | null
  etag: string | null
  state: 'ok' | 'deleted'
}

/** FNV-1a of the fields Google shows: a changed hash means "patch the event". */
export function itemHash(item: Omit<CalendarItem, 'hash'>): string {
  const text = JSON.stringify([
    item.starts_at,
    item.ends_at,
    item.all_day,
    item.title,
    item.description,
    item.url_path,
    item.color,
  ])
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

// Google's event colors (colorId 1–11).
const GOOGLE_COLORS: [string, string][] = [
  ['1', '#7986cb'],
  ['2', '#33b679'],
  ['3', '#8e24aa'],
  ['4', '#e67c73'],
  ['5', '#f6bf26'],
  ['6', '#f4511e'],
  ['7', '#039be5'],
  ['8', '#616161'],
  ['9', '#3f51b5'],
  ['10', '#0b8043'],
  ['11', '#d50000'],
]

const rgb = (hex: string) => {
  const n = Number.parseInt(hex.replace('#', '').slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}

/** The Google event color closest to a hex color. */
export function nearestColorId(hex: string | null): string | undefined {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return undefined
  const [r, g, b] = rgb(hex)
  let best: string | undefined
  let bestDistance = Infinity
  for (const [id, color] of GOOGLE_COLORS) {
    const [r2, g2, b2] = rgb(color)
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2
    if (d < bestDistance) [best, bestDistance] = [id, d]
  }
  return best
}

/** The key Hoot stores on its events, so a changed event can be traced back to its item. */
export const HOOT_KEY = 'hootKey'

const dateOnly = (iso: string) => iso.slice(0, 10)

/**
 * The Google event of an item. Blocks carry the "Započni" link as the event source and first line
 * of the description; Hoot's own reminders replace Google's for blocks.
 */
export function toEventBody(item: CalendarItem, origin: string | null, timeZone: string) {
  const url = origin && item.url_path ? `${origin}${item.url_path}` : null
  const body: GoogleEventBody = {
    summary: item.title,
    description: [url && item.kind === 'block' ? `▶ ${url}` : null, item.description]
      .filter(Boolean)
      .join('\n\n'),
    start: item.all_day
      ? { date: dateOnly(item.starts_at) }
      : { dateTime: item.starts_at, timeZone },
    end: item.all_day ? { date: dateOnly(item.ends_at) } : { dateTime: item.ends_at, timeZone },
    extendedProperties: { private: { [HOOT_KEY]: item.key } },
  }
  const colorId = nearestColorId(item.color)
  if (colorId) body.colorId = colorId
  if (url) body.source = { title: 'Hoot', url }
  if (item.kind === 'block') body.reminders = { useDefault: false, overrides: [] }
  if (item.kind === 'deadline') body.transparency = 'transparent'
  return body
}

export interface Reconciled {
  /** Item with its link: write the item into that event (changed, or reused for a new item). */
  patch: { item: CalendarItem; link: CalendarLink }[]
  insert: CalendarItem[]
  /** Links whose event goes (the item is gone); `remote: false` = already deleted in Google. */
  remove: { link: CalendarLink; remote: boolean }[]
}

/**
 * Wanted items vs the events Hoot wrote. A replan gives blocks new ids, so a block event without
 * its item is reused for a new block (same day first, closest start), which turns a replan into a
 * few patches instead of deleting and recreating every event.
 */
export function reconcile(items: CalendarItem[], links: CalendarLink[]): Reconciled {
  const byKey = new Map(links.filter((l) => l.item_key).map((l) => [l.item_key!, l]))
  const result: Reconciled = { patch: [], insert: [], remove: [] }
  const fresh: CalendarItem[] = []
  const used = new Set<string>()
  for (const item of items) {
    const link = byKey.get(item.key)
    if (!link) {
      fresh.push(item)
      continue
    }
    used.add(link.id)
    // Deleted in Google: stays away until the item itself changes (e.g. the block moves).
    if (link.state === 'deleted' && link.pushed_hash === item.hash) continue
    if (link.state === 'deleted') result.insert.push(item)
    else if (link.pushed_hash !== item.hash) result.patch.push({ item, link })
  }
  const spare = links.filter((l) => !used.has(l.id))
  const reusable = spare.filter((l) => l.kind === 'block' && l.state === 'ok')
  for (const item of fresh) {
    if (item.kind === 'block' && reusable.length > 0) {
      const start = Date.parse(item.starts_at)
      const day = dateOnly(item.starts_at)
      let best = 0
      let bestScore = Infinity
      reusable.forEach((l, i) => {
        // The same day first, then the closest start.
        const old = l.pushed_start ? Date.parse(l.pushed_start) : NaN
        const score = Number.isNaN(old)
          ? Number.MAX_SAFE_INTEGER
          : Math.abs(old - start) + (dateOnly(l.pushed_start!) === day ? 0 : 1e12)
        if (score < bestScore) [best, bestScore] = [i, score]
      })
      const [link] = reusable.splice(best, 1)
      used.add(link!.id)
      result.patch.push({ item, link: link! })
    } else result.insert.push(item)
  }
  for (const link of spare)
    if (!used.has(link.id)) result.remove.push({ link, remote: link.state === 'ok' })
  return result
}

/** Wall clock of an instant in a zone: date and minutes since midnight. */
function wall(instant: Date, timeZone: string) {
  const parts: Record<string, number> = {}
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(instant))
    if (p.type !== 'literal') parts[p.type] = Number(p.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${parts.year}-${pad(parts.month!)}-${pad(parts.day!)}`,
    minutes: (parts.hour! % 24) * 60 + parts.minute!,
  }
}

const previousDay = (date: string) => {
  const t = new Date(`${date}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}

/** Start and end of a timed Google event; null for all-day or malformed ones. */
export function eventTimes(event: GoogleEvent): { start: Date; end: Date } | null {
  if (!event.start?.dateTime || !event.end?.dateTime) return null
  const start = new Date(event.start.dateTime)
  const end = new Date(event.end.dateTime)
  return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ? null : { start, end }
}

/**
 * A block moved in Google as plan_blocks columns: `on_date` by the day boundary (a 01:00 block
 * belongs to the day before when the day starts at 04:00) and `start_min` as the wall clock on
 * that date (past midnight = more than 1440, as `zonedInstant` reads it).
 */
export function blockTimesFromEvent(
  event: GoogleEvent,
  boundary: { timeZone: string; dayStartMin: number },
) {
  const times = eventTimes(event)
  if (!times) return null
  const w = wall(times.start, boundary.timeZone)
  const beforeBoundary = w.minutes < boundary.dayStartMin
  const minutes = Math.round((times.end.getTime() - times.start.getTime()) / 60_000)
  if (minutes < 5 || minutes > 24 * 60) return null
  return {
    on_date: beforeBoundary ? previousDay(w.date) : w.date,
    start_min: beforeBoundary ? w.minutes + 1440 : w.minutes,
    planned_start: times.start.toISOString(),
    planned_minutes: minutes,
  }
}

/** An event of a picked Google calendar as an `external_events` row; null when it does not block. */
export function toBusyRow(event: GoogleEvent) {
  if (event.status === 'cancelled' || event.transparency === 'transparent') return null
  const allDay = Boolean(event.start?.date)
  let startsAt: Date
  let endsAt: Date
  if (allDay) {
    if (!event.start?.date || !event.end?.date) return null
    startsAt = new Date(`${event.start.date}T00:00:00Z`)
    endsAt = new Date(`${event.end.date}T00:00:00Z`)
  } else {
    const times = eventTimes(event)
    if (!times) return null
    startsAt = times.start
    endsAt = times.end
  }
  if (endsAt < startsAt) return null
  return {
    uid: event.id,
    startsAt,
    endsAt,
    allDay,
    title: event.summary ?? null,
    location: event.location ?? null,
    category: null as string | null,
  }
}

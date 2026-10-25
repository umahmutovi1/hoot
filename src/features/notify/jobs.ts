import { addDays, wallClock, type LocalDate } from '@/lib/day'

/**
 * Web Push jobs (PRD "Timer, pauza" → kraj pauze, decision Stage 9): the app knows when a
 * notification is due and writes it to `push_jobs` with its text; `notify` (pg_cron, every
 * minute) sends the due ones. Pure: what the jobs should be, and what to change to get there.
 */

export type JobKind = 'first_block' | 'break_end' | 'test' | 'block_reminder' | 'block_late'

/** Texts for the notification's buttons and the "Preskočeno" that replaces it (Stage 10c). */
export interface JobActions {
  start: string
  skip: string
  skippedTitle: string
  skippedBody: string
}

export interface PushJob {
  kind: JobKind
  /** First block: its local date. Break end: the session id. Block reminder: block id + offset. */
  ref: string
  send_at: string
  title: string
  body: string
  url: string | null
  /** Reminder and "Kasniš": the block (notify checks it is still not started before sending). */
  block_id?: string | null
  actions?: JobActions | null
}

export interface JobBlock {
  id: string
  on_date: string
  status: string
  planned_start: string | null
}

/** Reminder offsets the user can pick (`profiles.reminder_offsets_min`), longest first. */
export const REMINDER_OFFSETS = [120, 60, 30, 15, 5] as const
/** "Kasniš 15 min": this long after the planned start of a block not started or skipped. */
export const LATE_REMINDER_MIN = 15
/** Days ahead that get block reminders (recomputed with every plan). */
export const REMINDER_DAYS = 7

export interface ReminderBlock extends JobBlock {
  planned_minutes: number
}

/**
 * Quiet hours (PRD "Podsjetnici"): nothing between going to bed and getting up, from the rhythm
 * step (`sleep_min` / `wake_min`: [weekday, weekend], wall-clock minutes). Unknown rhythm = never.
 */
export function isQuiet(
  instant: Date,
  timeZone: string,
  sleep: number[] | null,
  wake: number[] | null,
): boolean {
  if (!sleep || !wake) return false
  const clock = wallClock(instant, timeZone)
  const weekday = new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay()
  const i = weekday === 0 || weekday === 6 ? 1 : 0
  const s = (sleep[i] ?? sleep[0]!) % 1440
  const w = (wake[i] ?? wake[0]!) % 1440
  const m = clock.minutes
  return s > w ? m >= s || m < w : m >= s && m < w
}

/**
 * Reminders before every timed planned block from today on (Stage 10c): one job per offset, and
 * "Kasniš 15 min" once per block, only when that moment is ahead and outside quiet hours. Whether
 * the block (or the one before it) has started is checked by `notify` when it is due.
 */
export function blockJobs<B extends ReminderBlock>(
  blocks: B[],
  today: LocalDate,
  now: Date,
  input: {
    offsets: number[]
    quiet: (at: Date) => boolean
    text: (block: B, offset: number | null) => { title: string; body: string }
    url: (block: B) => string
    actions: (block: B) => JobActions
  },
): PushJob[] {
  if (input.offsets.length === 0) return []
  const last = addDays(today, REMINDER_DAYS - 1)
  const out: PushJob[] = []
  const timed = blocks
    .filter(
      (b) =>
        b.status === 'planned' &&
        b.planned_start !== null &&
        b.on_date >= today &&
        b.on_date <= last,
    )
    .sort((a, b) => (a.planned_start! < b.planned_start! ? -1 : 1))
  for (const b of timed) {
    const start = Date.parse(b.planned_start!)
    const push = (kind: JobKind, ref: string, at: Date, offset: number | null) => {
      if (at <= now || input.quiet(at)) return
      out.push({
        kind,
        ref,
        send_at: at.toISOString(),
        url: input.url(b),
        block_id: b.id,
        actions: input.actions(b),
        ...input.text(b, offset),
      })
    }
    for (const offset of [...new Set(input.offsets)].sort((x, y) => y - x))
      push('block_reminder', `${b.id}:${offset}`, new Date(start - offset * 60_000), offset)
    push('block_late', b.id, new Date(start + LATE_REMINDER_MIN * 60_000), null)
  }
  return out
}

export interface SavedJob {
  id: string
  kind: string
  ref: string
  send_at: string
  title: string
  body: string
  url?: string | null
  sent_at: string | null
}

/** Kinds the app keeps in step with the plan (the rest are written once: break end, test). */
export const PLAN_JOB_KINDS: JobKind[] = ['first_block', 'block_reminder', 'block_late']

/**
 * From the saved plan jobs to the wanted ones: rows to upsert (new or changed) and ids to delete
 * (a block gone or moved, or notifications switched off). A job already sent is left alone.
 */
export function diffJobs(saved: SavedJob[], wanted: PushJob[], kinds: JobKind[] = ['first_block']) {
  const id = (j: { kind: string; ref: string }) => `${j.kind}|${j.ref}`
  const mine = saved.filter((j) => (kinds as string[]).includes(j.kind))
  const sent = new Set(mine.filter((j) => j.sent_at !== null).map(id))
  const open = mine.filter((j) => j.sent_at === null)
  const byRef = new Map(open.map((j) => [id(j), j]))
  const upsert = wanted.filter((w) => {
    if (sent.has(id(w))) return false
    const s = byRef.get(id(w))
    return (
      !s ||
      Date.parse(s.send_at) !== Date.parse(w.send_at) ||
      s.title !== w.title ||
      s.body !== w.body ||
      (s.url !== undefined && s.url !== w.url)
    )
  })
  const keep = new Set(wanted.map(id))
  const remove = open.filter((j) => !keep.has(id(j))).map((j) => j.id)
  return { upsert, remove }
}

/** VAPID public key (base64url) → the bytes `pushManager.subscribe()` wants. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** iPhone / iPad (also iPadOS that reports itself as a Mac with touch). */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

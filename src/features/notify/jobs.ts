import { addDays, type LocalDate } from '@/lib/day'

/**
 * Web Push jobs (PRD "Timer, pauza" → kraj pauze, decision Stage 9): the app knows when a
 * notification is due and writes it to `push_jobs` with its text; `notify` (pg_cron, every
 * minute) sends the due ones. Pure: what the jobs should be, and what to change to get there.
 */

export type JobKind = 'first_block' | 'break_end' | 'test'

export interface PushJob {
  kind: JobKind
  /** First block: its local date. Break end: the session id. */
  ref: string
  send_at: string
  title: string
  body: string
  url: string | null
}

/** Days ahead that get a "first block" notification (recomputed with every plan). */
export const FIRST_BLOCK_DAYS = 7
/** "Prvi blok dana": 10 min before it. */
export const FIRST_BLOCK_LEAD_MIN = 10

export interface JobBlock {
  id: string
  on_date: string
  status: string
  planned_start: string | null
}

/**
 * One job per day from today on: the first planned block with a time, 10 min before it, only
 * when that moment is still ahead.
 */
export function firstBlockJobs<B extends JobBlock>(
  blocks: B[],
  today: LocalDate,
  now: Date,
  text: (block: B) => { title: string; body: string },
): PushJob[] {
  const last = addDays(today, FIRST_BLOCK_DAYS - 1)
  const firstOf = new Map<string, B>()
  for (const b of blocks) {
    if (b.status !== 'planned' || b.planned_start === null) continue
    if (b.on_date < today || b.on_date > last) continue
    const prev = firstOf.get(b.on_date)
    if (!prev || b.planned_start < prev.planned_start!) firstOf.set(b.on_date, b)
  }
  const out: PushJob[] = []
  for (const [date, b] of [...firstOf].sort(([a], [c]) => (a < c ? -1 : 1))) {
    const at = new Date(Date.parse(b.planned_start!) - FIRST_BLOCK_LEAD_MIN * 60_000)
    if (at <= now) continue
    out.push({ kind: 'first_block', ref: date, send_at: at.toISOString(), url: '/', ...text(b) })
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
  sent_at: string | null
}

/**
 * From the saved "first block" jobs to the wanted ones: rows to upsert (new or changed) and ids
 * to delete (a day without a block any more, or notifications switched off). A day already
 * notified is left alone.
 */
export function diffJobs(saved: SavedJob[], wanted: PushJob[]) {
  const mine = saved.filter((j) => j.kind === 'first_block')
  const sent = new Set(mine.filter((j) => j.sent_at !== null).map((j) => j.ref))
  const open = mine.filter((j) => j.sent_at === null)
  const byRef = new Map(open.map((j) => [j.ref, j]))
  const upsert = wanted.filter((w) => {
    if (sent.has(w.ref)) return false
    const s = byRef.get(w.ref)
    return (
      !s ||
      Date.parse(s.send_at) !== Date.parse(w.send_at) ||
      s.title !== w.title ||
      s.body !== w.body
    )
  })
  const keep = new Set(wanted.map((w) => w.ref))
  const remove = open.filter((j) => !keep.has(j.ref)).map((j) => j.id)
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

// Web Push sending rules for `notify` (pure, tested with Vitest like the other _shared modules).

export interface DueJob {
  id: string
  user_id: string
  kind: string
  ref: string
  title: string
  body: string
  url: string | null
  send_at: string
  block_id?: string | null
  /** Button texts and the "Preskočeno" notification, in the user's language (Stage 10c). */
  actions?: { start: string; skip: string; skippedTitle: string; skippedBody: string } | null
}

/** A job more than 30 min late (the phone was off, cron paused) is dropped, not sent late. */
export const STALE_MS = 30 * 60_000

export function splitDue(jobs: DueJob[], now: Date): { send: DueJob[]; stale: DueJob[] } {
  const send: DueJob[] = []
  const stale: DueJob[] = []
  for (const j of jobs) {
    const at = Date.parse(j.send_at)
    if (at > now.getTime()) continue
    if (now.getTime() - at > STALE_MS) stale.push(j)
    else send.push(j)
  }
  return { send, stale }
}

/**
 * What the service worker shows (public/push-sw.js); the tag replaces an older one of the kind.
 * A block reminder carries Započni / Preskoči and the one-time token for `push-action`; one tag
 * per block, so "Kasniš" replaces the reminder and "Preskočeno" replaces both.
 */
export function payloadOf(job: DueJob, action?: { token: string; endpoint: string }): string {
  const block = job.block_id && (job.kind === 'block_reminder' || job.kind === 'block_late')
  return JSON.stringify({
    title: job.title,
    body: job.body,
    url: job.url ?? '/',
    tag: block ? `block:${job.block_id}` : `${job.kind}:${job.ref}`,
    ...(block && job.actions && action
      ? {
          actions: [
            { action: 'start', title: job.actions.start },
            { action: 'skip', title: job.actions.skip },
          ],
          skip: {
            endpoint: action.endpoint,
            token: action.token,
            title: job.actions.skippedTitle,
            body: job.actions.skippedBody,
          },
        }
      : {}),
  })
}

/** A one-time action token: 32 random bytes, base64url (only its hash is stored). */
export function newActionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** SHA-256 of a token, hex: what `push_jobs.action_token_hash` keeps. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** How long Preskoči in a notification works after it was sent. */
export const ACTION_TTL_MS = 12 * 60 * 60_000

export interface LiveBlock {
  id: string
  on_date: string
  planned_start: string | null
  planned_minutes: number
  status: string
  skip_requested_at: string | null
}

export interface LiveSession {
  block_id: string | null
  ended_at: string | null
}

/**
 * Is a block reminder or "Kasniš" still worth sending (PRD "Podsjetnici")? Not when the block is
 * gone, started, skipped or has a session; a reminder also not when the block before it on that
 * day is being studied right now (already learning, the next one comes after the break).
 */
export function blockJobLive(job: DueJob, blocks: LiveBlock[], sessions: LiveSession[]): boolean {
  if (job.kind !== 'block_reminder' && job.kind !== 'block_late') return true
  const block = blocks.find((b) => b.id === job.block_id)
  if (!block || block.status !== 'planned' || block.skip_requested_at) return false
  if (sessions.some((s) => s.block_id === block.id)) return false
  if (job.kind === 'block_late') return true
  const before = blocks
    .filter(
      (b) =>
        b.on_date === block.on_date &&
        b.id !== block.id &&
        b.planned_start !== null &&
        block.planned_start !== null &&
        b.planned_start < block.planned_start,
    )
    .sort((a, b) => (a.planned_start! < b.planned_start! ? 1 : -1))[0]
  return !(before && sessions.some((s) => s.block_id === before.id && s.ended_at === null))
}

/** The push service says the subscription is gone: delete it. */
export function isGone(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410
}

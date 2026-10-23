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

/** What the service worker shows (public/push-sw.js); the tag replaces an older one of the kind. */
export function payloadOf(job: DueJob): string {
  return JSON.stringify({
    title: job.title,
    body: job.body,
    url: job.url ?? '/',
    tag: `${job.kind}:${job.ref}`,
  })
}

/** The push service says the subscription is gone: delete it. */
export function isGone(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410
}

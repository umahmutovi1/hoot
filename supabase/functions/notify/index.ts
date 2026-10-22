// notify (Stage 9): pg_cron calls it every minute with x-cron-secret. Sends the due push_jobs
// (first block of the day, end of a planned break, test) to every subscription of their user,
// marks them sent and drops subscriptions the push service no longer knows. Endpoints and
// texts are never logged.
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { json } from '../_shared/cors.ts'
import { isGone, payloadOf, splitDue, type DueJob } from '../_shared/push.ts'

const BATCH = 200

interface Sub {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret)
    return json({ error: 'unauthorized' }, 401)
  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!url || !service || !publicKey || !privateKey || !subject)
    return json({ error: 'not_configured' }, 500)
  webpush.setVapidDetails(subject, publicKey, privateKey)
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const now = new Date()
    const { data: jobs, error } = await admin
      .from('push_jobs')
      .select('id, user_id, kind, ref, title, body, url, send_at')
      .is('sent_at', null)
      .lte('send_at', now.toISOString())
      .order('send_at')
      .limit(BATCH)
    if (error) return json({ error: 'failed' }, 500)
    const { send, stale } = splitDue(jobs as DueJob[], now)

    const users = [...new Set(send.map((j) => j.user_id))]
    const { data: subs, error: subsError } = users.length
      ? await admin
          .from('push_subscriptions')
          .select('id, user_id, endpoint, p256dh, auth')
          .in('user_id', users)
      : { data: [], error: null }
    if (subsError) return json({ error: 'failed' }, 500)

    const gone = new Set<string>()
    let sent = 0
    let failed = 0
    for (const job of send) {
      for (const sub of (subs as Sub[]).filter((s) => s.user_id === job.user_id)) {
        if (gone.has(sub.id)) continue
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadOf(job),
            { TTL: 600, urgency: 'high' },
          )
          sent++
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (isGone(status)) gone.add(sub.id)
          else {
            failed++
            console.error('push failed', status ?? 'no status')
          }
        }
      }
    }

    const done = [...send, ...stale].map((j) => j.id)
    if (done.length)
      await admin.from('push_jobs').update({ sent_at: now.toISOString() }).in('id', done)
    if (gone.size)
      await admin
        .from('push_subscriptions')
        .delete()
        .in('id', [...gone])
    return json({ jobs: send.length, sent, failed, stale: stale.length, gone: gone.size })
  } catch (err) {
    console.error('notify failed', err instanceof Error ? err.name : typeof err)
    return json({ error: 'failed' }, 500)
  }
})

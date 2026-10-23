import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { isIos, keyBytes } from './jobs'

// Web Push subscription of this device and the user's devices (push_subscriptions).

export const subscriptionsKey = (userId: string | undefined) => ['push', userId, 'subs'] as const
const deviceKey = (userId: string | undefined) => ['push', userId, 'device'] as const

export type PushSupport = 'ok' | 'unsupported' | 'ios_install' | 'denied' | 'not_configured'

/** What this browser can do: iOS only in the installed PWA (Home Screen), iOS 16.4+. */
export function pushSupport(): PushSupport {
  if (!env.VITE_VAPID_PUBLIC_KEY) return 'not_configured'
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (isIos(navigator.userAgent, navigator.maxTouchPoints) && (!standalone || !supported))
    return 'ios_install'
  if (!supported) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'ok'
}

/** Devices of the user with a subscription (any device: jobs are written only then). */
export function useSubscriptions() {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: subscriptionsKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('push_subscriptions').select('id, endpoint')
      if (error) throw error
      return data
    },
  })
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** This device's endpoint, when it is subscribed. */
export function useDeviceEndpoint() {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: deviceKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => (await currentSubscription())?.endpoint ?? null,
  })
}

export function usePushActions() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: subscriptionsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: deviceKey(userId) }),
      ]),
    [queryClient, userId],
  )

  /** Asks for permission (needs a tap on iOS) and saves the subscription. */
  const enable = useCallback(async () => {
    const key = env.VITE_VAPID_PUBLIC_KEY
    if (!key) throw new Error('not_configured')
    if ((await Notification.requestPermission()) !== 'granted') throw new Error('denied')
    const reg = await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      }))
    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
        user_agent: navigator.userAgent.slice(0, 300),
      },
      { onConflict: 'endpoint' },
    )
    if (error) throw error
    await refresh()
  }, [refresh])

  const disable = useCallback(async () => {
    const sub = await currentSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
    await refresh()
  }, [refresh])

  /** A test notification: due now, sent by the next `notify` run (within a minute). */
  const test = useCallback(async (title: string, body: string) => {
    const { error } = await supabase.from('push_jobs').insert({
      kind: 'test',
      ref: crypto.randomUUID(),
      send_at: new Date().toISOString(),
      title,
      body,
      url: '/settings',
    })
    if (error) throw error
  }, [])

  return { enable, disable, test }
}

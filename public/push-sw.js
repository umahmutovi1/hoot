// Web Push for Hoot, imported into the generated service worker (vite.config.ts →
// workbox.importScripts). `notify` sends { title, body, url, tag } and, for a block reminder
// (Stage 10c), `actions` (Započni / Preskoči) and `skip` { endpoint, token, title, body }.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Hoot', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: data.tag,
      renotify: Boolean(data.tag && data.tag.startsWith('block:')),
      // iOS web push shows no buttons: a tap opens the block, Preskoči is in the app.
      actions: Array.isArray(data.actions) ? data.actions : [],
      data: { url: data.url || '/', skip: data.skip || null, tag: data.tag },
    }),
  )
})

function openUrl(url) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => 'focus' in c)
    if (open) return open.focus().then((c) => (c && 'navigate' in c ? c.navigate(url) : c))
    return self.clients.openWindow(url)
  })
}

// Preskoči without opening the app: the one-time token goes to push-action, which records the
// skip; the app applies it (same rule as the button) when it next opens. If it fails, the block
// opens in the app instead.
function skipBlock(data) {
  return fetch(data.skip.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'skip', token: data.skip.token }),
  })
    .then((res) => {
      if (!res.ok) throw new Error('skip failed')
      return self.registration.showNotification(data.skip.title, {
        body: data.skip.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: data.tag,
        data: { url: '/' },
      })
    })
    .catch(() => openUrl(data.url || '/'))
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  if (event.action === 'skip' && data.skip) {
    event.waitUntil(skipBlock(data))
    return
  }
  event.waitUntil(openUrl(data.url || '/'))
})

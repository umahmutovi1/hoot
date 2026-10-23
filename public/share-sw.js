// Web Share Target for Hoot (Android, PRD "Ostale integracije"), imported into the generated
// service worker (vite.config.ts → workbox.importScripts). A shared PDF, image or text is kept in
// a cache for a moment and the app opens "Daj dokument" with it; nothing is sent anywhere here.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return
  event.respondWith(
    (async () => {
      const cache = await caches.open('hoot-share')
      await cache.delete('/shared-file')
      await cache.delete('/shared-text')
      try {
        const form = await event.request.formData()
        const file = form.get('file')
        if (file && typeof file !== 'string') {
          await cache.put(
            '/shared-file',
            new Response(file, {
              headers: {
                'content-type': file.type || 'application/octet-stream',
                'x-name': encodeURIComponent(file.name || 'dokument'),
              },
            }),
          )
        } else {
          const text = [form.get('title'), form.get('text'), form.get('url')]
            .filter((v) => typeof v === 'string' && v.trim())
            .join('\n')
          if (text) await cache.put('/shared-text', new Response(text))
        }
      } catch {
        // Nothing readable was shared: the chat opens without an attachment.
      }
      return Response.redirect('/chat?share=1', 303)
    })(),
  )
})

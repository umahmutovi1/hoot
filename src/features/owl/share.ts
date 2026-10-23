import type { SharedInput } from './store'

const CACHE = 'hoot-share'

/** What the service worker kept from Android "Podijeli" (public/share-sw.js), taken once. */
export async function takeShared(): Promise<SharedInput | null> {
  if (!('caches' in window)) return null
  const cache = await caches.open(CACHE)
  const file = await cache.match('/shared-file')
  const text = await cache.match('/shared-text')
  await cache.delete('/shared-file')
  await cache.delete('/shared-text')
  if (file) {
    const blob = await file.blob()
    const name = decodeURIComponent(file.headers.get('x-name') ?? 'dokument')
    return { type: 'file', file: new File([blob], name, { type: blob.type }) }
  }
  const body = text ? (await text.text()).trim() : ''
  return body ? { type: 'text', text: body } : null
}

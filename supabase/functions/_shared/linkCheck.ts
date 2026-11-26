// Server-side fetches of links that come from a user or a web search (find-academic-info,
// find-toc, sync-calendar). Network, so it lives apart from the pure search modules.
import { isPublicLink } from './academicSearch.ts'

const CHECK_TIMEOUT_MS = 6000
const MAX_REDIRECTS = 5

/**
 * GET of a public link. Redirects are followed by hand, so every hop is checked to be a public
 * host (a link may not lead the function to an internal address); null when a hop is not public
 * or there are too many.
 */
export async function fetchPublic(
  url: string,
  options: { timeoutMs: number; headers?: Record<string, string> },
): Promise<Response | null> {
  let next = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicLink(next)) return null
    const res = await fetch(next, {
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: options.headers,
    })
    const location = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !location) return res
    await res.body?.cancel()
    next = new URL(location, next).toString()
  }
  return null
}

export async function opens(url: string): Promise<boolean> {
  // A redirect is not followed (it could lead to an internal host); a 3xx already means it opens.
  if (!isPublicLink(url)) return false
  const attempt = async (method: 'HEAD' | 'GET') => {
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: method === 'GET' ? { range: 'bytes=0-1023' } : {},
    })
    await res.body?.cancel()
    return res.status < 400
  }
  try {
    return (await attempt('HEAD')) || (await attempt('GET'))
  } catch {
    return false
  }
}

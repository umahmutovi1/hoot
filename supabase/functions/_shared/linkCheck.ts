// Whether a found link opens, for the web searches (find-academic-info, find-toc). Network, so it
// lives apart from the pure search modules.
import { isPublicLink } from './academicSearch.ts'

const CHECK_TIMEOUT_MS = 6000

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

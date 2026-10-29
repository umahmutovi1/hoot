/** What a connected calendar holds, from its iCal link (docs/CALENDAR-SYNC.md). */
export type FeedKind = 'busy' | 'deadlines'

/**
 * A Moodle calendar export (`/calendar/export_execute.php?…&authtoken=…`) holds due dates, so its
 * events are offered as deadlines; any other link is busy time. The user can still change it on
 * the feed, so new feeds need no question.
 */
export function feedKindFromUrl(url: string): FeedKind {
  let parsed: URL
  try {
    parsed = new URL(url.trim().replace(/^webcal:\/\//i, 'https://'))
  } catch {
    return 'busy'
  }
  const moodle =
    /\/calendar\/export_execute\.php$/i.test(parsed.pathname) ||
    (parsed.searchParams.has('authtoken') && parsed.searchParams.has('userid'))
  return moodle ? 'deadlines' : 'busy'
}

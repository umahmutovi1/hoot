import { ruleKind, weeklySeries, type EventKind } from '@/lib/calendar/classify'
import type { EventRow, FeedRow } from './api'

export interface EventKinds {
  /** The kind of every event: the user's, else the AI's, else the rules', else busy for now. */
  kindOf: Map<string, EventKind>
  /** Titled events the rules cannot read and nobody classified yet: for classify-events. */
  unclassified: EventRow[]
  /** Event ids in a weekly series (for the AI's "weekly"). */
  series: Set<string>
}

/** Effective kinds of the connected calendars' events (docs/CALENDAR-SYNC.md "Klasifikacija"). */
export function eventKinds(
  rows: EventRow[],
  feeds: Pick<FeedRow, 'id' | 'kind'>[],
  subjectNames: string[],
  timeZone: string,
): EventKinds {
  const timed = rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    allDay: r.all_day,
  }))
  const series = weeklySeries(timed, timeZone)
  const deadlineFeeds = new Set(feeds.filter((f) => f.kind === 'deadlines').map((f) => f.id))
  const kindOf = new Map<string, EventKind>()
  const unclassified: EventRow[] = []
  rows.forEach((row, i) => {
    const stored = row.kind as EventKind | null
    if (stored) return void kindOf.set(row.id, stored)
    const rule = ruleKind(timed[i]!, {
      deadlineFeed: deadlineFeeds.has(row.feed_id),
      inSeries: series.has(row.id),
      subjectNames,
    })
    kindOf.set(row.id, rule ?? 'busy')
    if (!rule && row.title) unclassified.push(row)
  })
  return { kindOf, unclassified, series }
}

import { useMemo } from 'react'
import { useSessions } from '@/features/session/api'
import { useDayBoundary } from '@/features/settings/profile'
import { wallClock } from '@/lib/day'

export interface ActualTime {
  /** Minutes on the block's day when its session started (past midnight: +24 h). */
  startMin: number
  minutes: number
}

/**
 * When a done block was really studied (feedback after 10b): its latest finished session's start
 * and length, so Raspored and Plan → Dan show the actual time instead of the planned one.
 */
export function useActualTimes(): Map<string, ActualTime> {
  const { data: sessions = [] } = useSessions()
  const boundary = useDayBoundary()
  return useMemo(() => {
    const out = new Map<string, ActualTime & { at: string }>()
    for (const s of sessions) {
      if (!s.block_id || !s.ended_at) continue
      const prev = out.get(s.block_id)
      if (prev && prev.at > s.started_at) continue
      const start = new Date(s.started_at)
      const wall = wallClock(start, boundary.timeZone).minutes
      out.set(s.block_id, {
        at: s.started_at,
        startMin: wall < boundary.dayStartMin ? wall + 1440 : wall,
        minutes: Math.max(
          1,
          Math.round((new Date(s.ended_at).getTime() - start.getTime()) / 60000),
        ),
      })
    }
    return out
  }, [sessions, boundary])
}

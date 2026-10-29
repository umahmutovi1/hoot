import { useMemo } from 'react'
import { useAllSources, useCardReviews, usePlanBlocks } from '@/features/plan/api'
import { blocksOn, useUnitIndex } from '@/features/plan/model'
import { usePlanStore } from '@/features/plan/store'
import { useActiveSession, useSessions } from '@/features/session/api'
import { toSegment } from '@/features/session/model'
import { useNow } from '@/features/session/useNow'
import { useDayBoundary } from '@/features/settings/profile'
import { materialOf, rateOf, subjectMaterialProgress } from '@/features/sources/model'
import { useSubjects } from '@/features/subjects/api'
import { addDays, diffDays, localDay, startOfWeek, wallClock } from '@/lib/day'
import { activeMs, MINUTE } from '@/lib/session/timer'

/** Today's plan and the numbers around it (Danas). */
export function usePlanToday() {
  const boundary = useDayBoundary()
  const now = useNow(60_000)
  const today = localDay(now, boundary)
  const wall = wallClock(now, boundary.timeZone).minutes
  const nowMin = wall < boundary.dayStartMin ? wall + 1440 : wall
  const blocksQuery = usePlanBlocks(boundary)
  const blocks = useMemo(() => blocksQuery.data ?? [], [blocksQuery.data])
  const units = useUnitIndex()
  const model = usePlanStore((s) => s.model)
  const { data: subjects = [] } = useSubjects()
  const { data: sessions = [] } = useSessions()
  const { data: active } = useActiveSession()
  const { data: sources = [] } = useAllSources()
  const { data: cards = [] } = useCardReviews()

  return useMemo(() => {
    const todayBlocks = blocksOn(blocks, today)
    const monday = startOfWeek(today)
    const sunday = addDays(monday, 6)
    const counted = (b: (typeof blocks)[number]) => b.status !== 'skipped'
    const plannedToday = todayBlocks.filter(counted).reduce((s, b) => s + b.planned_minutes, 0)
    const plannedWeek = blocks
      .filter((b) => b.on_date >= monday && b.on_date <= sunday && counted(b))
      .reduce((s, b) => s + b.planned_minutes, 0)

    const studied = (from: string, to: string) => {
      let total = 0
      for (const s of sessions) {
        const day = localDay(new Date(s.started_at), boundary)
        if (day < from || day > to || !s.ended_at) continue
        total += activeMs(s.study_segments.map(toSegment), new Date(s.ended_at))
      }
      if (active && localDay(new Date(active.session.started_at), boundary) >= from)
        total += activeMs(active.segments.map(toSegment), now)
      return Math.round(total / MINUTE)
    }

    // Next exam and the subject's progress ("Spremnost" until the forecast in Stage 11).
    const exams = subjects
      .filter((s) => !s.archived)
      .flatMap((s) =>
        s.assessments
          .filter((a) => !a.passed && !a.contingent)
          .map((a) => ({
            subject: s,
            on: localDay(new Date(a.at), { ...boundary, dayStartMin: 0 }),
          })),
      )
      .filter((x) => x.on >= today)
      .sort((a, b) => a.on.localeCompare(b.on))
    const next = exams[0]
    const subjectSources = next ? sources.filter((s) => s.subject_id === next.subject.id) : []
    const readiness =
      subjectSources.length > 0
        ? Math.round(
            subjectMaterialProgress(
              subjectSources.map((s) => materialOf(s, rateOf(s, sources).mean)),
            ) * 100,
          )
        : null

    return {
      boundary,
      now,
      today,
      nowMin,
      blocks,
      todayBlocks,
      units,
      cards,
      model,
      loaded: blocksQuery.data !== undefined,
      plannedToday,
      doneToday: studied(today, today),
      plannedWeek,
      doneWeek: studied(monday, sunday),
      nextExamDays: next ? diffDays(today, next.on) : null,
      readiness,
    }
  }, [
    blocks,
    today,
    nowMin,
    units,
    cards,
    model,
    subjects,
    sessions,
    active,
    sources,
    boundary,
    now,
    blocksQuery.data,
  ])
}

export type PlanToday = ReturnType<typeof usePlanToday>

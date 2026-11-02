import { readPages } from '@/lib/readPages'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { useProgress } from '@/features/progress/useProgress'
import { useSessions } from '@/features/session/api'
import { toSegment, STUDY_MODES } from '@/features/session/model'
import { addDays, localDay, wallClock, type LocalDate, type DayBoundary } from '@/lib/day'
import { activeMs, MINUTE } from '@/lib/session/timer'
import { sessionRhythm } from '@/lib/session/rhythm'
import { insights, shownInsights, type InsightInput } from '@/lib/insights'
import { subjectEffects } from '@/lib/slots/completion'
import { weekWindow } from '@/lib/progress/week'
import { supabase } from '@/lib/supabase'
import { latestFeedback, useFeedback } from './feedback'

export function useInsightData() {
  const data = useProgress()
  const userId = useAuth().session?.user.id
  const sessions = useSessions().data
  const feedback = useFeedback()
  const since = data ? addDays(data.today, -42) : ''
  const history = useQuery({
    queryKey: ['insight-history', userId, since],
    enabled: Boolean(data && userId),
    queryFn: async () => {
      const [reviews, units, skips] = await Promise.all([
        readPages((from, to) =>
          supabase
            .from('review_logs')
            .select('*')
            .gte('reviewed_at', `${since}T00:00:00Z`)
            .order('reviewed_at')
            .order('id')
            .range(from, to),
        ),
        readPages((from, to) =>
          supabase
            .from('session_units')
            .select('*,study_sessions!inner(ended_at)')
            .gte('study_sessions.ended_at', `${since}T00:00:00Z`)
            .order('session_id')
            .order('unit_id')
            .range(from, to),
        ),
        readPages((from, to) =>
          supabase
            .from('block_skips')
            .select('subject_id,on_date')
            .gte('on_date', since)
            .order('id')
            .range(from, to),
        ),
      ])
      return { reviews, units, skips }
    },
  })
  return useMemo(() => {
    if (!data || !sessions || (!history.data && !history.isError) || !feedback.data) return null
    const records = history.data ?? { reviews: [], units: [], skips: [] }
    const boundary = {
      timeZone: data.inputs.profile.timezone,
      dayStartMin: data.inputs.profile.day_start_min,
    }
    const window = weekWindow(data.today)
    const minutes = sessions.map((s) => ({
      session: s,
      onDate: localDay(new Date(s.started_at), boundary),
      minutes: activeMs(s.study_segments.map(toSegment), new Date(s.ended_at!)) / MINUTE,
    }))
    const byUnit = new Map(
      data.inputs.sources.flatMap((s) =>
        s.units.map((u) => [u.id, { ...u, subjectId: s.subject_id }] as const),
      ),
    )
    const calibration: InsightInput['calibration'] = []
    const pairedReviews = new Set<string>()
    for (const u of [...records.units].sort((a, b) =>
      (b.study_sessions.ended_at ?? '').localeCompare(a.study_sessions.ended_at ?? ''),
    )) {
      const unit = byUnit.get(u.unit_id)
      const ended = u.study_sessions.ended_at
      if (!unit || !ended || u.level_after === null || u.level_after < 2) continue
      const review = records.reviews.find(
        (r) =>
          r.unit_id === u.unit_id &&
          r.card_id === null &&
          r.reviewed_at >= ended &&
          r.reviewed_at <= new Date(Date.parse(ended) + 7 * 86400000).toISOString(),
      )
      if (review && !pairedReviews.has(review.id)) {
        pairedReviews.add(review.id)
        calibration.push({
          subjectId: unit.subjectId,
          predicted: u.level_after / 3,
          actual: review.recall / 2,
        })
      }
    }
    for (const s of data.inputs.subjects)
      for (const e of s.assessments)
        if (
          e.readiness_before !== null &&
          e.result_points !== null &&
          e.result_max &&
          !e.result_annulled
        )
          calibration.push({
            subjectId: s.id,
            predicted: e.readiness_before / 5,
            actual: Math.min(1, e.result_points / e.result_max),
          })
    const postponements: InsightInput['postponements'] = [
      ...records.skips.map((s) => ({ subjectId: s.subject_id, onDate: s.on_date })),
    ]
    for (const b of data.inputs.blocks) {
      if (b.origin !== 'ai' || b.on_date >= data.today) continue
      const session = sessions.find((s) => s.block_id === b.id)
      const late =
        session &&
        b.planned_start &&
        Date.parse(session.started_at) - Date.parse(b.planned_start) > 30 * 60000
      if (b.status === 'missed' || (b.status === 'planned' && !session) || late)
        postponements.push({ subjectId: b.subject_id, onDate: b.on_date })
    }
    const speeds = STUDY_MODES.map((mode) => {
      const rows = minutes.filter((r) => r.session.mode === mode && r.session.origin === 'timer')
      const values = rows.flatMap((r) => {
        let actual = 0,
          expected = 0
        for (const done of records.units.filter(
          (u) => u.session_id === r.session.id && u.amount_done && u.amount_done > 0,
        )) {
          const unit = byUnit.get(done.unit_id)
          const estimate = data.model.built.state.units.find((u) => u.id === done.unit_id)
          if (!unit || !estimate || unit.amount <= 0) continue
          actual += done.minutes
          expected += (done.amount_done! * estimate.minutes) / unit.amount
        }
        return expected > 0 ? [actual / expected] : []
      })
      return {
        mode,
        ratio: values.reduce((a, b) => a + b, 0) / Math.max(1, values.length),
        sessions: values.length,
      }
    })
    const input: InsightInput = {
      today: data.today,
      slots: data.signals,
      preset: data.model.built.state.preset,
      rhythm: sessionRhythm(
        sessions
          .filter((s) => s.origin === 'timer')
          .map((s) => ({
            segments: s.study_segments.map(toSegment),
            endedAt: new Date(s.ended_at!),
            plannedMinutes: s.planned_minutes,
          })),
        new Date(`${data.today}T23:59:59Z`),
      ),
      modeSpeeds: speeds,
      subjectEffects: subjectEffects(data.inputs.completion),
      postponements,
      calibration,
      weekModes: minutes
        .filter((r) => r.onDate >= window.from && r.onDate <= window.to)
        .map((r) => ({ mode: r.session.mode, minutes: r.minutes })),
      sessionEnds: sessions.map((s) => {
        const end = new Date(s.ended_at!),
          onDate = localDay(end, boundary),
          clock = wallClock(end, boundary.timeZone)
        const calendar = localDay(end, { ...boundary, dayStartMin: 0 })
        return { onDate, endMin: clock.minutes + (calendar > onDate ? 1440 : 0) }
      }),
      exams: data.model.built.state.goals
        .filter((g) => g.kind === 'exam')
        .map((g) => ({ goalId: g.id, subjectId: g.subjectId, on: g.on })),
    }
    const list = insights(input)
    const dismissed = new Set(
      list
        .filter((i) => latestFeedback(feedback.data, i.id)?.status === 'not_useful')
        .map((i) => i.id),
    )
    return {
      list: shownInsights(list, dismissed),
      all: list,
      input,
      history: records,
      historyError: history.isError,
      retry: history.refetch,
      minutes,
      window,
      feedback: feedback.data,
    }
  }, [data, sessions, history.data, history.isError, history.refetch, feedback.data])
}

/** Historical unit strength uses the last recorded stability at that date, never a future review. */
export function historicalMemory(
  reviews: {
    unit_id: string
    card_id: string | null
    reviewed_at: string
    stability_after: number | null
  }[],
  unitId: string,
  on: LocalDate,
  boundary: DayBoundary,
) {
  const rows = reviews
    .filter(
      (r) =>
        r.unit_id === unitId &&
        r.card_id === null &&
        r.stability_after !== null &&
        localDay(new Date(r.reviewed_at), boundary) <= on,
    )
    .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))
  const last = rows[0]
  return last
    ? {
        stability: last.stability_after!,
        lastReviewOn: localDay(new Date(last.reviewed_at), boundary),
      }
    : null
}

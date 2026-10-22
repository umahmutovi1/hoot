import { useEffect, useMemo } from 'react'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useDayBoundary } from '@/features/settings/profile'
import { addDays, type LocalDate } from '@/lib/day'
import { suggestions as rules, type Suggestion } from '@/lib/scheduler'
import { usePlanBlocks } from './api'
import { usePlanStore } from './store'
import { usePlanUi } from './ui'

/** Missed planned days in a row up to yesterday (fresh start after 2). */
function missedStreak(
  blocks: { on_date: string; status: string; origin: string }[],
  today: LocalDate,
) {
  let streak = 0
  for (let d = addDays(today, -1); ; d = addDays(d, -1)) {
    const day = blocks.filter((b) => b.on_date === d && b.origin === 'ai')
    if (day.length === 0 || day.some((b) => b.status === 'done' || b.status === 'skipped')) break
    if (!day.every((b) => b.status === 'missed' || b.status === 'planned')) break
    streak++
    if (streak > 14) break
  }
  return streak
}

/**
 * Suggestion cards of the latest plan (PRD "Scheduler" step 12), without the ones hidden by
 * "Kasnije" or an accepted risk; most urgent first.
 */
export function useSuggestions(subjectId?: string): Suggestion[] {
  const model = usePlanStore((s) => s.model)
  const boundary = useDayBoundary()
  const blocks = usePlanBlocks(boundary).data
  const schedule = useScheduleData()
  const { snoozed, accepted, deficits, recordDeficit } = usePlanUi()
  const today = model?.built.today

  const total = model?.result.deficits.reduce((s, d) => s + d.minutes, 0) ?? 0
  useEffect(() => {
    if (today) recordDeficit(today, total)
  }, [today, total, recordDeficit])

  return useMemo(() => {
    if (!model || !today) return []
    const previous = Object.entries(deficits)
      .filter(([day]) => day < today)
      .sort(([a], [b]) => (a < b ? 1 : -1))[0]?.[1]
    const list = rules({
      state: model.built.state,
      result: model.result,
      today,
      behind: model.built.behind,
      targetGrade: model.built.targetGrade,
      examPeriods: schedule.periods
        .filter((p) => p.kind === 'exam')
        .map((p) => ({ id: p.id, startsOn: p.startsOn, endsOn: p.endsOn })),
      missedStreak: missedStreak(blocks ?? [], today),
      previousDeficit: previous ?? null,
    })
    return list.filter((s) => {
      if ((snoozed[s.key] ?? '') >= today) return false
      if (s.kind === 'deficit' && (accepted[s.goalId] ?? -1) >= s.minutes) return false
      if (subjectId && (!('subjectId' in s) || s.subjectId !== subjectId)) return false
      return true
    })
  }, [model, today, deficits, schedule.periods, blocks, snoozed, accepted, subjectId])
}

import { useEffect } from 'react'
import { useCelebration } from '@/components/celebrate-store'
import { milestoneBetween, remembered, type Progress } from '@/lib/celebrate'
import { startOfWeek } from '@/lib/day'
import type { PlanToday } from './usePlanToday'

const KEY = 'hoot.progress'

function read(): Progress | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Progress) : null
  } catch {
    return null
  }
}

function write(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // storage unavailable: no celebration next time, nothing else breaks
  }
}

/**
 * Celebrates a finished block, the whole day and the week's plan when Danas sees them, however they
 * were done (timer, "Odradila sam bez timera", another device). Waits while a session runs, since
 * the week's minutes then grow by the minute.
 */
export function useMilestones(plan: PlanToday, sessionRunning: boolean) {
  const celebrate = useCelebration((s) => s.celebrate)
  const counted = plan.todayBlocks.filter((b) => b.status !== 'skipped')
  const next: Progress = {
    date: plan.today,
    week: startOfWeek(plan.today),
    doneToday: counted.filter((b) => b.status === 'done').length,
    plannedToday: counted.length,
    doneWeek: plan.doneWeek,
    plannedWeek: plan.plannedWeek,
  }
  const key = JSON.stringify(next)
  useEffect(() => {
    if (!plan.loaded || sessionRunning) return
    const current = JSON.parse(key) as Progress
    const prev = read()
    const milestone = milestoneBetween(prev, current)
    write(remembered(prev, current))
    if (milestone) celebrate(milestone)
  }, [key, plan.loaded, sessionRunning, celebrate])
}

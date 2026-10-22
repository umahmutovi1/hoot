import { addDays, type LocalDate } from '@/lib/day'
import {
  GROWTH,
  GROWTH_FLOOR_MIN,
  GROWTH_WINDOW_DAYS,
  RHO_MAX,
  RHO_MIN,
  RHO_PRIOR,
  RHO_PRIOR_DAYS,
  RHO_WINDOW_DAYS,
} from './constants'

/** One past day for the realization factor and the growth limit. */
export interface DayHistory {
  date: LocalDate
  /** Planned minutes of AI blocks that day. */
  plannedMin: number
  /** Minutes studied on those AI blocks. */
  doneAiMin: number
  /** Every minute studied that day (any session). */
  studiedMin: number
  /** "Danas ne mogu": the day's blocks were skipped. */
  skipped: boolean
}

export interface Realization {
  rho: number
  /** Days with a plan in the window (n). */
  days: number
  /** done / planned over those days; null without any. */
  measured: number | null
}

/**
 * Realization factor ρ (PRD "Scheduler" step 1): done / planned minutes of AI blocks over the
 * last 14 days before `today`, shrunk towards 0.8: ρ = (n·ρ_measured + 7·0.8) / (n + 7), clamped
 * to [0.5, 1]. Days without a plan and "Danas ne mogu" days do not count.
 */
export function realization(history: DayHistory[], today: LocalDate): Realization {
  const from = addDays(today, -RHO_WINDOW_DAYS)
  const days = history.filter(
    (d) => d.date >= from && d.date < today && d.plannedMin > 0 && !d.skipped,
  )
  const planned = days.reduce((s, d) => s + d.plannedMin, 0)
  const done = days.reduce((s, d) => s + Math.min(d.doneAiMin, d.plannedMin), 0)
  const n = days.length
  const measured = n > 0 ? done / planned : null
  const raw = (n * (measured ?? 0) + RHO_PRIOR_DAYS * RHO_PRIOR) / (n + RHO_PRIOR_DAYS)
  return { rho: round3(Math.min(RHO_MAX, Math.max(RHO_MIN, raw))), days: n, measured }
}

/**
 * Base of the growth limit: average studied minutes over the last 7 days (zeros included). A
 * user without any planned day in that window has no limit yet (new user, decision Stage 8b).
 */
export function growthBase(history: DayHistory[], today: LocalDate): number | null {
  const from = addDays(today, -GROWTH_WINDOW_DAYS)
  const window = history.filter((d) => d.date >= from && d.date < today)
  if (!window.some((d) => d.plannedMin > 0)) return null
  const studied = window.reduce((s, d) => s + d.studiedMin, 0)
  return Math.round(studied / GROWTH_WINDOW_DAYS)
}

/**
 * Most AI minutes (without the buffer before an exam) on the k-th planned day (0 = `from`):
 * the first day gets 1.25 × the 7-day average (at least 60 min), every next day 1.25× more
 * (decision Stage 8b: a ramp, so work slides to later days instead of piling onto tomorrow).
 */
export function growthLimit(base: number | null, k: number): number {
  if (base === null) return Infinity
  return Math.floor(Math.max(GROWTH_FLOOR_MIN, base * GROWTH) * GROWTH ** k)
}

const round3 = (x: number) => Math.round(x * 1000) / 1000

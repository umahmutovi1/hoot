import { addDays, type LocalDate } from '@/lib/day'

// Energy of the day (PRD "Dopune, 29. okt 2026" → Energija dana): "Nemam energije" / "Pun/a sam
// energije", one tap, only for that date. What "low" means differs between people (nothing at
// all for one, 20% or 60% of a usual day for another), so the factor is learned from the days
// themselves, like ρ: a prior, shrunk towards what the user really studied on such days.

export type Energy = 'low' | 'normal' | 'high'

/** Prior share of a usual day on a low day ("Nemam energije"). */
export const LOW_ENERGY_FACTOR = 0.6
/** Prior on a high day; the plan still never goes over the growth limit. */
export const HIGH_ENERGY_FACTOR = 1.25
/** Weight of the prior in days (as `RHO_PRIOR_DAYS`). */
export const ENERGY_PRIOR_DAYS = 3
/** Low and high days are rare: a longer window than ρ. */
export const ENERGY_WINDOW_DAYS = 56
/** Usual days needed before a ratio means anything. */
export const ENERGY_MIN_USUAL_DAYS = 3

export interface EnergyDay {
  date: LocalDate
  energy: Energy
  /** Every minute studied that day. */
  studiedMin: number
  /** Planned minutes of AI blocks that day (a usual day counts only with a plan). */
  plannedMin: number
  /** "Danas ne mogu". */
  skipped: boolean
}

export interface EnergyFactors {
  low: number
  high: number
  /** Low / high days that were measured (n). */
  lowDays: number
  highDays: number
  /** Median studied minutes of a usual day in the window; null without enough of them. */
  usualMin: number | null
}

const round3 = (x: number) => Math.round(x * 1000) / 1000

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/**
 * Personal factors over the last 8 weeks before `today`: each low (high) day's studied minutes
 * over the median of usual days with a plan, averaged and shrunk towards the prior:
 * f = (n·mean + 3·prior) / (n + 3). Low is clamped to [0, 1] (0 = "then I really do nothing"),
 * high to [1, 1.25]. Today and "Danas ne mogu" days do not count.
 */
export function energyFactors(days: EnergyDay[], today: LocalDate): EnergyFactors {
  const from = addDays(today, -ENERGY_WINDOW_DAYS)
  const window = days.filter((d) => d.date >= from && d.date < today && !d.skipped)
  const usual = window.filter((d) => d.energy === 'normal' && d.plannedMin > 0)
  const usualMin =
    usual.length >= ENERGY_MIN_USUAL_DAYS ? median(usual.map((d) => d.studiedMin)) : null
  const factor = (energy: 'low' | 'high', prior: number, min: number, max: number) => {
    const ratios =
      usualMin && usualMin > 0
        ? window.filter((d) => d.energy === energy).map((d) => d.studiedMin / usualMin)
        : []
    const n = ratios.length
    const sum = ratios.reduce((s, r) => s + Math.min(r, max), 0)
    const raw = (sum + ENERGY_PRIOR_DAYS * prior) / (n + ENERGY_PRIOR_DAYS)
    return { f: round3(Math.min(max, Math.max(min, raw))), n }
  }
  const low = factor('low', LOW_ENERGY_FACTOR, 0, 1)
  const high = factor('high', HIGH_ENERGY_FACTOR, 1, HIGH_ENERGY_FACTOR)
  return { low: low.f, high: high.f, lowDays: low.n, highDays: high.n, usualMin }
}

import type { DayBoundary, LocalDate } from '@/lib/day'
import {
  retrievabilityOn,
  strengthBand,
  unitStrength,
  weightedStrength,
  type StrengthBand,
} from '@/lib/srs'
import type { Unit } from '@/features/sources/model'
import { memoryOf, type MemoryRow } from './memory'

/** Strength of a unit today with its cards (PRD "Jačina na ekranima"); null = not in review. */
export function strengthOf(
  unit: MemoryRow,
  cards: (MemoryRow & { unit_id: string })[],
  today: LocalDate,
  boundary: DayBoundary,
  params?: readonly number[],
): number | null {
  const own = memoryOf(unit, boundary)
  const cardRs = cards.flatMap((c) => {
    const m = memoryOf(c, boundary)
    return m ? [retrievabilityOn(m, today, params)] : []
  })
  return unitStrength(own ? retrievabilityOn(own, today, params) : null, cardRs)
}

export interface UnitStrength {
  unit: Unit
  minutes: number
  strength: number | null
}

export interface StrengthSummary {
  /** Minute-weighted mean over units in review; null when none is. */
  average: number | null
  /** Units in review in outline order, with their band. */
  units: (UnitStrength & { strength: number; band: StrengthBand })[]
  /** Units in review under "Dobro" (below 75%) or due: they need a check. */
  needCheck: UnitStrength[]
}

/**
 * Strength of a subject, source, exam or topic from its leaves (minutes from the estimates).
 * Units not tested yet are left out of the average, not counted as zero.
 */
export function strengthSummary(
  leaves: { unit: Unit; minutes: number }[],
  cards: (MemoryRow & { unit_id: string })[],
  today: LocalDate,
  boundary: DayBoundary,
  params?: readonly number[],
): StrengthSummary {
  const byUnit = new Map<string, typeof cards>()
  for (const c of cards) byUnit.set(c.unit_id, [...(byUnit.get(c.unit_id) ?? []), c])
  const all: UnitStrength[] = leaves.map(({ unit, minutes }) => ({
    unit,
    minutes,
    strength: strengthOf(unit, byUnit.get(unit.id) ?? [], today, boundary, params),
  }))
  const inReview = all.flatMap((x) =>
    x.strength === null ? [] : [{ ...x, strength: x.strength, band: strengthBand(x.strength) }],
  )
  return {
    average: weightedStrength(all),
    units: inReview,
    needCheck: all.filter(
      (x) =>
        x.unit.archived_at === null &&
        x.unit.level >= 1 &&
        ((x.strength !== null && x.strength < 0.75) ||
          (x.unit.next_review_on !== null && x.unit.next_review_on <= today)),
    ),
  }
}

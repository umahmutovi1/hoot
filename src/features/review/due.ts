import type { DayBoundary, LocalDate } from '@/lib/day'
import { retrievabilityOn } from '@/lib/srs'
import type { Unit } from '@/features/sources/model'
import { memoryOf, type MemoryRow } from './memory'

/** A card's review columns. */
export type CardDue = { id: string; unit_id: string; next_review_on: string | null } & MemoryRow

export interface DueUnit {
  unit: Unit
  /** Strength today; 0 for a check of what was read (never tested). */
  strength: number
  /** Cards of the unit due today. */
  cardIds: string[]
  /** The unit itself is due (not only its cards). */
  unitDue: boolean
}

/**
 * Units with a check due today or earlier, itself or through a card. Read but untested units
 * (level 1) are included; archived ones and units not started are not. Lowest strength first.
 */
export function dueUnits(
  units: Iterable<Unit>,
  cards: CardDue[],
  today: LocalDate,
  boundary: DayBoundary,
  params?: readonly number[],
): DueUnit[] {
  const dueCards = new Map<string, string[]>()
  for (const c of cards)
    if (c.next_review_on !== null && c.next_review_on <= today)
      dueCards.set(c.unit_id, [...(dueCards.get(c.unit_id) ?? []), c.id])
  const out: DueUnit[] = []
  for (const unit of units) {
    if (unit.archived_at !== null) continue
    const unitDue = unit.next_review_on !== null && unit.next_review_on <= today && unit.level >= 1
    const cardIds = dueCards.get(unit.id) ?? []
    if (!unitDue && cardIds.length === 0) continue
    const memory = memoryOf(unit, boundary)
    out.push({
      unit,
      strength: memory ? retrievabilityOn(memory, today, params) : 0,
      cardIds,
      unitDue,
    })
  }
  return out.sort(
    (a, b) =>
      a.strength - b.strength ||
      (a.unit.next_review_on ?? '').localeCompare(b.unit.next_review_on ?? '') ||
      a.unit.id.localeCompare(b.unit.id),
  )
}

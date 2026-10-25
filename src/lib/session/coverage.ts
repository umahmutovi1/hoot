/**
 * "Do koje stranice" (PRD "Prije mjerenja"): at the end of a session the user says how far they
 * got in a source. Coverage turns that into the amount done per unit, from where the session
 * started to the reached point, in the source's unit order.
 */

export interface OrderedUnit {
  id: string
  /** Pages, slides, questions or items of the unit. */
  amount: number
}

export interface Point {
  unitId: string
  /** Amount into the unit: from 0 (its start) to `amount` (its end). */
  offset: number
}

export interface Covered {
  unitId: string
  amountDone: number
  /** The reached point is at or past the unit's end. */
  complete: boolean
  /** Offset reached in the unit (where the next session continues). */
  end: number
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/**
 * Amount done per unit between `from` and `to` (both inclusive of the units they name). Returns
 * nothing when `to` is before `from` or either unit is unknown.
 */
export function coverage(units: OrderedUnit[], from: Point, to: Point): Covered[] {
  const a = units.findIndex((u) => u.id === from.unitId)
  const b = units.findIndex((u) => u.id === to.unitId)
  if (a < 0 || b < 0 || b < a) return []
  const out: Covered[] = []
  for (let i = a; i <= b; i++) {
    const u = units[i]!
    const start = i === a ? clamp(from.offset, 0, u.amount) : 0
    const end = i === b ? clamp(to.offset, 0, u.amount) : u.amount
    const amountDone = Math.max(0, end - start)
    if (amountDone > 0) out.push({ unitId: u.id, amountDone, complete: end >= u.amount, end })
  }
  return out
}

/** Page-based units: page number → offset into the unit (reaching page p means p is read). */
export function pageOffset(pageStart: number, page: number): number {
  return page - pageStart + 1
}

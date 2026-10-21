/**
 * Minutes per unit for `session_units.minutes` (PRD decision, Stage 7). A segment on unit U covers
 * U and the covered units of the same source after it, up to the next unit with its own segment:
 * tapping "5.1" once and reading through 5.3 splits the time over 5.1–5.3. Minutes are split in
 * proportion to the estimated time of the covered part (`weight`). Segments without a unit go to
 * covered units no segment reaches, or to all covered units.
 */

export interface AllocationUnit {
  id: string
  sourceId: string
  /** Position inside the source. */
  position: number
  /** Covered amount in this session (0 = touched but not advanced). */
  amountDone: number
  /** Estimated minutes of the covered part; only the ratio between units matters. */
  weight: number
}

export interface Allocation {
  minutes: Map<string, number>
  /** Minutes without a unit to land on (nothing covered). */
  unassigned: number
}

function spread(minutes: number, units: AllocationUnit[], out: Map<string, number>) {
  const total = units.reduce((s, u) => s + Math.max(0, u.weight), 0)
  for (const u of units) {
    const share = total > 0 ? Math.max(0, u.weight) / total : 1 / units.length
    out.set(u.id, (out.get(u.id) ?? 0) + minutes * share)
  }
}

export function allocateMinutes(
  minutesByUnit: Map<string | null, number>,
  units: AllocationUnit[],
): Allocation {
  const out = new Map<string, number>()
  const byId = new Map(units.map((u) => [u.id, u]))
  const reached = new Set<string>()
  let pool = minutesByUnit.get(null) ?? 0

  const bySource = new Map<string, AllocationUnit[]>()
  for (const u of units) bySource.set(u.sourceId, [...(bySource.get(u.sourceId) ?? []), u])

  for (const [unitId, minutes] of minutesByUnit) {
    if (unitId === null || minutes <= 0) continue
    const own = byId.get(unitId)
    if (!own) {
      // A unit the caller knows nothing about keeps its time as is.
      out.set(unitId, (out.get(unitId) ?? 0) + minutes)
      continue
    }
    const source = [...bySource.get(own.sourceId)!].sort((a, b) => a.position - b.position)
    const group = [own]
    for (const u of source) {
      if (u.position <= own.position) continue
      if ((minutesByUnit.get(u.id) ?? 0) > 0) break
      group.push(u)
    }
    for (const u of group) reached.add(u.id)
    const covered = group.filter((u) => u.amountDone > 0)
    if (covered.length === 0) out.set(own.id, (out.get(own.id) ?? 0) + minutes)
    else spread(minutes, covered, out)
  }

  const covered = units.filter((u) => u.amountDone > 0)
  if (pool > 0 && covered.length > 0) {
    const orphans = covered.filter((u) => !reached.has(u.id))
    spread(pool, orphans.length > 0 ? orphans : covered, out)
    pool = 0
  }
  return { minutes: out, unassigned: pool }
}

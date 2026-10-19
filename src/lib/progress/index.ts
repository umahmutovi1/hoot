/**
 * Progress (PRD "Model izvora, jedinica i progresa"), always weighted by estimated minutes:
 *   p_u = level/3,  P_source = Σ p·m / Σ m (over leaves),  P_subject = Σ w·P / Σ w.
 * Computed from units on every render, never stored. Archived units are filtered out by the
 * caller. Parents take their progress from their leaves; status changes only on leaves.
 */

export interface ProgressUnit {
  id: string
  parentId: string | null
  level: number
  minutes: number
}

export interface Progress {
  /** 0–1 */
  fraction: number
  totalMinutes: number
  remainingMinutes: number
}

export const EMPTY_PROGRESS: Progress = { fraction: 0, totalMinutes: 0, remainingMinutes: 0 }

export function unitFraction(level: number): number {
  return Math.min(3, Math.max(0, level)) / 3
}

/** Units without (active) children. */
export function leavesOf<T extends ProgressUnit>(units: T[]): T[] {
  const parents = new Set(units.map((u) => u.parentId).filter(Boolean))
  return units.filter((u) => !parents.has(u.id))
}

/** Leaves under `rootId` (the root itself when it has no children). */
export function subtreeLeaves<T extends ProgressUnit>(units: T[], rootId: string): T[] {
  const children = new Map<string, T[]>()
  for (const u of units) {
    if (u.parentId) children.set(u.parentId, [...(children.get(u.parentId) ?? []), u])
  }
  const root = units.find((u) => u.id === rootId)
  if (!root) return []
  const out: T[] = []
  const walk = (u: T) => {
    const kids = children.get(u.id)
    if (!kids) out.push(u)
    else kids.forEach(walk)
  }
  walk(root)
  return out
}

export function progressOf(leaves: ProgressUnit[]): Progress {
  const totalMinutes = leaves.reduce((s, u) => s + u.minutes, 0)
  if (totalMinutes <= 0) return EMPTY_PROGRESS
  const done = leaves.reduce((s, u) => s + unitFraction(u.level) * u.minutes, 0)
  return { fraction: done / totalMinutes, totalMinutes, remainingMinutes: totalMinutes - done }
}

/** Minutes of leaves at each level 0–3, for the stacked bar on Izvor and Predmet. */
export function levelMinutes(leaves: ProgressUnit[]): [number, number, number, number] {
  const out: [number, number, number, number] = [0, 0, 0, 0]
  for (const u of leaves) {
    const level = Math.min(3, Math.max(0, u.level)) as 0 | 1 | 2 | 3
    out[level] += u.minutes
  }
  return out
}

export interface WeightedSource {
  /** Manual share 0–1 ("questions weigh 50%"); null = its share of the subject's minutes. */
  weight: number | null
  progress: Progress
}

/**
 * Subject progress. Sources without a manual weight split what the manual weights leave, in
 * proportion to their minutes. Only manual weights → normalized to sum to 1.
 */
export function subjectProgress(sources: WeightedSource[]): number {
  const manual = sources.filter((s) => s.weight !== null && s.weight > 0)
  const auto = sources.filter((s) => s.weight === null && s.progress.totalMinutes > 0)
  const manualSum = manual.reduce((s, x) => s + x.weight!, 0)
  const autoMinutes = auto.reduce((s, x) => s + x.progress.totalMinutes, 0)
  const rest = auto.length ? Math.max(0, 1 - manualSum) : 0

  const weighted = [
    ...manual.map((s) => ({ w: s.weight!, p: s.progress.fraction })),
    ...auto.map((s) => ({
      w: (rest * s.progress.totalMinutes) / autoMinutes,
      p: s.progress.fraction,
    })),
  ]
  const total = weighted.reduce((s, x) => s + x.w, 0)
  if (total <= 0) return 0
  return weighted.reduce((s, x) => s + x.w * x.p, 0) / total
}

import type { SourceMaterial } from '@/features/sources/model'
import { leavesOf } from '@/lib/progress'
import { scopeOf, type ScopeExam, type ScopeRow } from '@/lib/progress/scope'

export type SourceChoice = 'all' | 'none' | 'part'

/** One source in the exam sheet: how much of it the exam covers, as the leaves in scope. */
export interface SourcePick {
  choice: SourceChoice
  /** Leaf units in scope; used when `choice` is 'part'. */
  leaves: Set<string>
}

function tree(material: SourceMaterial) {
  const units = material.units.map((u) => ({ id: u.id, parentId: u.parent_id }))
  const leaves = leavesOf(units.map((u) => ({ ...u, level: 0, minutes: 0 }))).map((l) => l.id)
  return { units, leaves }
}

/** Leaf ids of the source. */
export function sourceLeaves(material: SourceMaterial): string[] {
  return tree(material).leaves
}

/** All / none / part of the source, from the leaves in scope. */
export function choiceOf(material: SourceMaterial, inScope: Set<string>): SourceChoice {
  const leaves = sourceLeaves(material)
  const count = leaves.filter((id) => inScope.has(id)).length
  if (count === 0) return 'none'
  return count === leaves.length ? 'all' : 'part'
}

/** What the exam covers of one source now (saved rows). */
export function pickOf(material: SourceMaterial, exam: ScopeExam, rows: ScopeRow[]): SourcePick {
  const { units, leaves } = tree(material)
  const scope = scopeOf(exam, units, rows)
  const inScope = new Set(leaves.filter((id) => scope.has(id)))
  return { choice: choiceOf(material, inScope), leaves: inScope }
}

/** Leaves in scope after a pick: the whole source, nothing, or the chosen part. */
export function leavesOfPick(material: SourceMaterial, pick: SourcePick): Set<string> {
  if (pick.choice === 'all') return new Set(sourceLeaves(material))
  if (pick.choice === 'none') return new Set()
  return pick.leaves
}

/**
 * The fewest rows for one exam and one source so that exactly `inScope` leaves are covered.
 * A unit whose leaves are all in (or all out) gets one row that also covers sub-units added
 * later; a row is written only where it differs from the exam's default (`scope_all`).
 */
export function rowsForLeaves(
  material: SourceMaterial,
  exam: ScopeExam,
  inScope: Set<string>,
): ScopeRow[] {
  const children = new Map<string | null, string[]>()
  for (const u of material.units) {
    children.set(u.parent_id, [...(children.get(u.parent_id) ?? []), u.id])
  }
  const leavesUnder = new Map<string, string[]>()
  const collect = (id: string): string[] => {
    const kids = children.get(id)
    const leaves = kids ? kids.flatMap(collect) : [id]
    leavesUnder.set(id, leaves)
    return leaves
  }
  const roots = children.get(null) ?? []
  roots.forEach(collect)

  const rows: ScopeRow[] = []
  const walk = (id: string) => {
    const leaves = leavesUnder.get(id)!
    const count = leaves.filter((l) => inScope.has(l)).length
    if (count === leaves.length || count === 0) {
      const included = count > 0
      if (included !== exam.scopeAll) rows.push({ assessmentId: exam.id, unitId: id, included })
      return
    }
    children.get(id)!.forEach(walk)
  }
  roots.forEach(walk)
  return rows
}

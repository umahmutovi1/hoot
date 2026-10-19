import type { SourceMaterial } from '@/features/sources/model'
import { leavesOf } from '@/lib/progress'
import { scopeOf, type ScopeRow } from '@/lib/progress/scope'

export type SourceChoice = 'all' | 'none'

/** Which of the subject's sources this exam covers: all of it, none, or a part (ObimIspita). */
export function sourceState(
  material: SourceMaterial,
  exam: { id: string; scopeAll: boolean },
  rows: ScopeRow[],
): SourceChoice | 'part' {
  const units = material.units.map((u) => ({ id: u.id, parentId: u.parent_id }))
  const leaves = leavesOf(units.map((u) => ({ ...u, level: 0, minutes: 0 })))
  const inScope = scopeOf(exam, units, rows)
  const count = leaves.filter((l) => inScope.has(l.id)).length
  if (count === 0) return 'none'
  return count === leaves.length ? 'all' : 'part'
}

/**
 * Rows for one exam and one source after "Cijeli" / "Ne ulazi": top-level units carry the
 * choice for their sub-units. A scope_all exam needs rows only to leave material out.
 */
export function rowsForSource(
  material: SourceMaterial,
  exam: { id: string; scopeAll: boolean },
  choice: SourceChoice,
): ScopeRow[] {
  const top = material.units.filter((u) => u.parent_id === null)
  if (exam.scopeAll === (choice === 'all')) return []
  return top.map((u) => ({ assessmentId: exam.id, unitId: u.id, included: choice === 'all' }))
}

/**
 * Exam scope (PRD "Ispiti i obim gradiva", "Obim ispita"). `assessment_units` rows say which
 * units an exam covers. A row on a parent covers its sub-units unless a sub-unit has its own row.
 * - Exam with `scope_all`: everything except units with `included = false`.
 * - Other exams: only units with `included = true`.
 */

export interface ScopeExam {
  id: string
  scopeAll: boolean
}

export interface ScopeRow {
  assessmentId: string
  unitId: string
  included: boolean
}

export interface ScopeUnit {
  id: string
  parentId: string | null
}

export function inScope(
  exam: ScopeExam,
  unit: ScopeUnit,
  unitsById: Map<string, ScopeUnit>,
  rows: Map<string, boolean>,
): boolean {
  let current: ScopeUnit | undefined = unit
  while (current) {
    const row = rows.get(current.id)
    if (row !== undefined) return row
    current = current.parentId ? unitsById.get(current.parentId) : undefined
  }
  return exam.scopeAll
}

/** Ids of the units in the exam's scope. */
export function scopeOf(exam: ScopeExam, units: ScopeUnit[], rows: ScopeRow[]): Set<string> {
  const unitsById = new Map(units.map((u) => [u.id, u]))
  const own = new Map(
    rows.filter((r) => r.assessmentId === exam.id).map((r) => [r.unitId, r.included]),
  )
  return new Set(units.filter((u) => inScope(exam, u, unitsById, own)).map((u) => u.id))
}

/**
 * What the ObimIspita row shows for a unit:
 * - `exams`: the partial (non-`scope_all`) exams it is assigned to; `scope_all` exams cover it too
 * - `excluded`: "Ne ulazi", excluded from every exam
 * - `unassigned`: no rows; only `scope_all` exams cover it
 */
export type ScopeChoice =
  { kind: 'exams'; examIds: string[] } | { kind: 'excluded' } | { kind: 'unassigned' }

export function choiceOf(unitId: string, exams: ScopeExam[], rows: ScopeRow[]): ScopeChoice {
  const ids = new Set(exams.map((e) => e.id))
  const own = rows.filter((r) => r.unitId === unitId && ids.has(r.assessmentId))
  const included = own.filter((r) => r.included).map((r) => r.assessmentId)
  if (included.length > 0) {
    // Keep the exams' order so the choice compares equal to the segment it came from.
    return { kind: 'exams', examIds: exams.filter((e) => included.includes(e.id)).map((e) => e.id) }
  }
  if (own.some((r) => !r.included)) return { kind: 'excluded' }
  return { kind: 'unassigned' }
}

/** The complete set of rows a unit should have for this subject's exams after a choice. */
export function rowsForChoice(unitId: string, exams: ScopeExam[], choice: ScopeChoice): ScopeRow[] {
  switch (choice.kind) {
    case 'exams':
      return exams
        .filter((e) => !e.scopeAll && choice.examIds.includes(e.id))
        .map((e) => ({ assessmentId: e.id, unitId, included: true }))
    case 'excluded':
      return exams.map((e) => ({ assessmentId: e.id, unitId, included: false }))
    case 'unassigned':
      return []
  }
}

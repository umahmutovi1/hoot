// Subject goal → priority (PRD "Dopune, 5. nov 2026": Cilj predmeta). The UI asks two things,
// "Uslovni predmet" and an optional target grade; `subjects.priority` is computed from them.
// Priority 1 is never picked here: it stays for AI suggestions and older subjects.

export interface SubjectGoal {
  /** Must be passed to enrol further. */
  conditional: boolean
  /** Target grade 6–10, or null for none. */
  targetGrade: number | null
}

/** uslovni → 5; otherwise no grade 3, 6 → 2, 7–8 → 3, 9–10 → 4. */
export function priorityFromGoal({ conditional, targetGrade }: SubjectGoal): number {
  if (conditional) return 5
  if (targetGrade === null) return 3
  if (targetGrade <= 6) return 2
  if (targetGrade <= 8) return 3
  return 4
}

/** The switch shows "Uslovni" for priority 5 (set by the switch, an AI suggestion or by hand). */
export function isConditional(priority: number): boolean {
  return priority === 5
}

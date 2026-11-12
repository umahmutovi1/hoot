/** Number of onboarding steps (PRD "Onboarding"). */
export const ONBOARDING_STEPS = 9

/** The browser's time zone (PRD: onboarding takes it from the browser). */
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** "Prvi predmet" (PRD "Onboarding", step 7 there; 8 here with "Gdje studiraš?"). */
export const SUBJECT_STEP = 8

/**
 * The first-subject step is skipped once an import gave a subject (PRD, Dopune 5. nov 2026): a
 * subject from the plan i program (it keeps its literature) or one that already has an exam. A
 * subject from the timetable alone still gets its exam there.
 */
export function skipsSubjectStep(
  subjects: readonly {
    archived: boolean
    syllabus_literature: unknown
    assessments: readonly unknown[]
  }[],
): boolean {
  return subjects.some(
    (s) => !s.archived && (s.syllabus_literature != null || s.assessments.length > 0),
  )
}

/** The step after or before `step`, past a skipped first-subject step. */
export function stepFrom(step: number, dir: 1 | -1, skipSubject: boolean): number {
  const next = step + dir
  return skipSubject && next === SUBJECT_STEP ? next + dir : next
}

import type { Enums, Tables } from '@/types/database'

export type Subject = Tables<'subjects'>
export type Assessment = Tables<'assessments'>
export type Deadline = Tables<'deadlines'>
export type AssessmentKind = Enums<'assessment_kind'>
export type ExamFormat = Enums<'exam_format'>
export type DeadlineKind = Enums<'deadline_kind'>

export type SubjectWithAssessments = Subject & { assessments: Assessment[] }

/** Stored in `subjects.color`; the DB check constraint allows exactly these keys. */
export const SUBJECT_COLORS = ['pink', 'lavender', 'blue', 'green', 'orange', 'slate'] as const
export type SubjectColor = (typeof SUBJECT_COLORS)[number]

export const STUDY_MODES = ['regular', 'campaign'] as const
export type StudyMode = (typeof STUDY_MODES)[number]

export const PRIORITIES = [1, 2, 3, 4, 5] as const
export type Priority = (typeof PRIORITIES)[number]

/** Clamps a stored or form priority to 1–5 (the DB check guarantees it; this keeps types narrow). */
export function asPriority(n: number): Priority {
  return Math.min(5, Math.max(1, Math.round(n))) as Priority
}
export const DEFAULT_PRIORITY = 3

export const ASSESSMENT_KINDS = ['partial', 'final', 'integral', 'makeup', 'other'] as const
export const EXAM_FORMATS = ['written', 'oral', 'combined', 'project', 'other'] as const
export const DEADLINE_KINDS = ['assignment', 'custom'] as const

export const POINTS_UNITS = ['points', 'percent'] as const
export type PointsUnit = (typeof POINTS_UNITS)[number]

/**
 * Defaults applied when an exam's type is picked: only the comprehensive (integral) exam
 * covers all material; it and the makeup are taken only if needed.
 */
export function examKindDefaults(kind: AssessmentKind) {
  return { scopeAll: kind === 'integral', contingent: kind === 'integral' || kind === 'makeup' }
}

export function isSubjectColor(value: string | null): value is SubjectColor {
  return SUBJECT_COLORS.includes(value as SubjectColor)
}

/** Next upcoming assessment that is not passed; contingent ones only when nothing else is left. */
/**
 * A makeup (popravni) is shown only once its exam is known to be failed: a result that does not
 * pass, or an annulled one (decision after 10b). Until then it lives in its exam's sheet.
 */
export function isShownExam(exam: Assessment, all: Assessment[]): boolean {
  if (!exam.retake_of && exam.kind !== 'makeup') return true
  const target = all.find((a) => a.id === exam.retake_of)
  if (!target) return false
  return (target.result_points !== null || target.result_annulled) && !target.passed
}

export function shownExams(assessments: Assessment[]): Assessment[] {
  return assessments.filter((e) => isShownExam(e, assessments))
}

export function nextAssessment(assessments: Assessment[], now: Date): Assessment | undefined {
  const upcoming = shownExams(assessments)
    .filter((a) => !a.passed && new Date(a.at) >= startOfLocalDay(now))
    .sort((a, b) => a.at.localeCompare(b.at))
  return upcoming.find((a) => !a.contingent) ?? upcoming[0]
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Exams are entered as a local date; `assessments.at` stores 09:00 local time on that day. */
export const EXAM_HOUR = 9

/** `yyyy-MM-dd` (local) → ISO timestamp at EXAM_HOUR local time. */
export function examAtFromDate(date: string): string {
  return localDateAt(date, EXAM_HOUR, 0).toISOString()
}

/** Deadlines without a time are due at the end of the local day. */
export function dueAtFromDate(date: string): string {
  return localDateAt(date, 23, 59).toISOString()
}

export function localDateAt(date: string, hours: number, minutes: number) {
  const [y = NaN, m = NaN, d = NaN] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hours, minutes)
}

/** ISO timestamp → `yyyy-MM-dd` in local time. */
export function localDateOf(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

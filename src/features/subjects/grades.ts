import type { TFunction } from 'i18next'
import {
  DEFAULT_SCALE,
  isValidScale,
  itemWorth,
  type GradeItem,
  type GradeSubject,
} from '@/lib/grades'
import type { Assessment, Deadline, Subject } from './model'

// Rows → inputs of src/lib/grades.

export function examItem(a: Assessment): GradeItem {
  return {
    id: a.id,
    kind: a.kind,
    at: a.at,
    pointsMax: a.points_max,
    pointsUnit: a.points_unit === 'percent' ? 'percent' : 'points',
    passMinPct: a.pass_min_pct,
    entryMinPoints: a.entry_min_points,
    retakeOf: a.retake_of,
    resultPoints: a.result_points,
    resultMax: a.result_max,
    annulled: a.result_annulled,
    passed: a.passed,
  }
}

export function deadlineItem(d: Deadline): GradeItem {
  return {
    id: d.id,
    kind: 'deadline',
    at: d.due_at,
    pointsMax: d.points_max,
    pointsUnit: d.points_unit === 'percent' ? 'percent' : 'points',
    passMinPct: d.pass_min_pct,
    entryMinPoints: null,
    retakeOf: null,
    resultPoints: d.result_points,
    resultMax: d.result_max,
    annulled: false,
    passed: null,
  }
}

/** Exams and the subject's deadlines as grade items. */
export function gradeItemsOf(
  subject: { id: string; assessments: Assessment[] },
  deadlines: Deadline[],
): GradeItem[] {
  return [
    ...subject.assessments.map(examItem),
    ...deadlines.filter((d) => d.subject_id === subject.id).map(deadlineItem),
  ]
}

/** Stored `grade_scale` (jsonb) → five thresholds, or null for the default. */
export function parseScale(json: unknown): number[] | null {
  if (!Array.isArray(json)) return null
  const scale = json.map(Number)
  return isValidScale(scale) ? scale : null
}

/** The profile's scale for all subjects (`profiles.points_total`, `grade_scale`). */
export interface GlobalScale {
  points_total: number
  grade_scale: unknown
}

/** Points total and scale of a subject: its own when `custom_scale`, otherwise the global one. */
export function gradeSubjectOf(
  s: Pick<Subject, 'points_total' | 'grade_scale' | 'custom_scale'>,
  global: GlobalScale | undefined,
): GradeSubject {
  return scaleOf(s.custom_scale ? s : global)
}

/** Points total and scale from stored values; undefined = defaults (profile not loaded). */
export function scaleOf(stored: GlobalScale | undefined): GradeSubject {
  return {
    pointsTotal: stored?.points_total ?? DEFAULT_POINTS_TOTAL,
    scale: parseScale(stored?.grade_scale) ?? DEFAULT_SCALE,
  }
}

export const DEFAULT_POINTS_TOTAL = 100

/** Points an exam or deadline carries within its subject; null = no points. */
export function worthOf(id: string, items: GradeItem[], pointsTotal: number): number | null {
  const item = items.find((i) => i.id === id)
  return item ? itemWorth(item, items, pointsTotal) : null
}

/** Points shown in the UI: at most one decimal. */
export function formatPoints(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)
}

/** "40 bodova" / "14% ocjene" · "prag 50%" for a row's details; empty without points. */
export function pointsDetails(
  t: TFunction,
  item: Pick<GradeItem, 'pointsMax' | 'pointsUnit' | 'passMinPct'>,
  worth: number | null,
  locale: string,
): string[] {
  if (worth === null) return []
  const carries =
    item.pointsMax !== null && item.pointsUnit === 'percent'
      ? t('grades.shareOfGrade', { n: formatPoints(item.pointsMax, locale) })
      : pointsLabel(t, worth, locale)
  return [
    carries,
    item.passMinPct !== null &&
      t('grades.thresholdShort', { pct: formatPoints(item.passMinPct, locale) }),
  ].filter((s): s is string => Boolean(s))
}

/** "29 bodova" / "2 boda" / "1 bod" with the right plural form. */
export function pointsLabel(t: TFunction, n: number, locale: string): string {
  return t('grades.points', { count: Math.round(n), n: formatPoints(n, locale) })
}

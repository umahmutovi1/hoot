import { z } from 'zod'
import {
  ASSESSMENT_KINDS,
  DEADLINE_KINDS,
  EXAM_FORMATS,
  POINTS_UNITS,
  STUDY_MODES,
  SUBJECT_COLORS,
} from './model'

// Error messages are i18n keys; forms render them with t().
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date')
const name = (max: number) =>
  z.string().trim().min(1, 'validation.required').max(max, 'validation.tooLong')
const points = z.number().positive('validation.positive').max(1000, 'validation.tooLarge')
const pct = z.number().min(0, 'validation.positive').max(100, 'validation.percentMax')

/** Points an exam or a deadline carries (PRD "Bodovi"); every field is optional. */
const gradeFields = {
  pointsMax: points.nullable(),
  pointsUnit: z.enum(POINTS_UNITS),
  /** Pass threshold, always stored in % of the item. */
  passMinPct: pct.nullable(),
}

export const GRADE_FIELD_DEFAULTS = {
  pointsMax: null,
  pointsUnit: 'points',
  passMinPct: null,
} as const

const shareWithinGrade = <T extends { pointsMax: number | null; pointsUnit: string }>(
  item: T,
  ctx: z.RefinementCtx,
) => {
  if (item.pointsUnit === 'percent' && item.pointsMax !== null && item.pointsMax > 100) {
    ctx.addIssue({ code: 'custom', path: ['pointsMax'], message: 'validation.percentMax' })
  }
}

export const assessmentFormSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(ASSESSMENT_KINDS),
    title: name(60),
    /** Exam day, or the earliest possible day when the date is tentative. */
    date: isoDate,
    format: z.enum(EXAM_FORMATS),
    scopeAll: z.boolean(),
    contingent: z.boolean(),
    dateTentative: z.boolean(),
    /** Latest possible day of a tentative exam; ignored otherwise. */
    dateLatest: isoDate.nullable(),
    /** Exam period of the academic calendar the tentative range comes from. */
    examPeriodId: z.string().nullable(),
    ...gradeFields,
    /** Points needed from earlier items to take this exam. */
    entryMinPoints: points.nullable(),
    /** Makeups: the exam they repeat. */
    retakeOf: z.string().nullable(),
    /** "Dan prije samo za ovaj predmet"; absent = leave the saved answer as it is. */
    eveReserved: z.boolean().nullable().optional(),
  })
  .superRefine((a, ctx) => {
    shareWithinGrade(a, ctx)
    if (!a.dateTentative) return
    if (!a.dateLatest) {
      ctx.addIssue({ code: 'custom', path: ['dateLatest'], message: 'validation.rangeEnd' })
    } else if (a.dateLatest < a.date) {
      ctx.addIssue({ code: 'custom', path: ['dateLatest'], message: 'validation.rangeOrder' })
    }
  })
export type AssessmentForm = z.infer<typeof assessmentFormSchema>

export const EXAM_GRADE_DEFAULTS = {
  ...GRADE_FIELD_DEFAULTS,
  entryMinPoints: null,
  retakeOf: null,
} as const

/** The exam sheet also asks which exam a makeup repeats. */
export const examSheetSchema = assessmentFormSchema.superRefine((a, ctx) => {
  if (a.kind === 'makeup' && !a.retakeOf) {
    ctx.addIssue({ code: 'custom', path: ['retakeOf'], message: 'validation.retakeOf' })
  }
})

export const subjectFormSchema = z
  .object({
    id: z.uuid(),
    name: name(80),
    color: z.enum(SUBJECT_COLORS),
    priority: z.number().int().min(1).max(5),
    studyMode: z.enum(STUDY_MODES),
    campaignStartOn: isoDate.nullable(),
    /** "Željena ocjena" in the Cilj section (6–10, optional). */
    targetGrade: z.number().int().min(6).max(10).nullable(),
    /** Academic year and semester (Stage 10c); absent = leave the saved ones as they are. */
    academicYearId: z.string().nullable().optional(),
    semesterNo: z.number().int().min(1).max(12).nullable().optional(),
    assessments: z.array(assessmentFormSchema),
  })
  .refine((s) => s.studyMode === 'campaign' || s.campaignStartOn === null, {
    path: ['campaignStartOn'],
    message: 'validation.campaignStartOnlyForCampaign',
  })
export type SubjectForm = z.infer<typeof subjectFormSchema>

export const deadlineFormSchema = z
  .object({
    id: z.uuid(),
    subjectId: z.uuid().nullable(),
    title: name(80),
    kind: z.enum(DEADLINE_KINDS),
    date: isoDate,
    // Optional estimate in hours; with it the deadline enters the plan as `deadline` blocks.
    estHours: z.number().positive('validation.positive').max(200, 'validation.tooLarge').nullable(),
    notes: z.string().trim().max(500, 'validation.tooLong').nullable(),
    ...gradeFields,
  })
  .superRefine(shareWithinGrade)
export type DeadlineForm = z.infer<typeof deadlineFormSchema>

/** "Rezultat": points out of the test's maximum, or a percentage (max = 100). */
export const resultFormSchema = z
  .object({
    mode: z.enum(['points', 'percent']),
    points: z.number('validation.required').min(0, 'validation.positive'),
    max: z
      .number('validation.required')
      .positive('validation.positive')
      .max(1000, 'validation.tooLarge'),
    passed: z.boolean(),
  })
  .refine((r) => r.points <= r.max, { path: ['points'], message: 'validation.resultOverMax' })
export type ResultForm = z.infer<typeof resultFormSchema>

/** Grade scale: lower bounds in % for 6..10, strictly increasing; points total; target grade. */
export const gradeScaleFormSchema = z
  .object({
    pointsTotal: points,
    scale: z
      .array(
        z
          .number('validation.required')
          .gt(0, 'validation.positive')
          .max(100, 'validation.percentMax'),
      )
      .length(5),
    targetGrade: z.number().int().min(6).max(10).nullable(),
  })
  .superRefine((s, ctx) => {
    s.scale.forEach((n, i) => {
      if (i > 0 && n <= s.scale[i - 1]!) {
        ctx.addIssue({ code: 'custom', path: ['scale', i], message: 'validation.scaleOrder' })
      }
    })
  })
export type GradeScaleForm = z.infer<typeof gradeScaleFormSchema>

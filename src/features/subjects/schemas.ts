import { z } from 'zod'
import {
  ASSESSMENT_KINDS,
  DEADLINE_KINDS,
  EXAM_FORMATS,
  STUDY_MODES,
  SUBJECT_COLORS,
} from './model'

// Error messages are i18n keys; forms render them with t().
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date')
const name = (max: number) =>
  z.string().trim().min(1, 'validation.required').max(max, 'validation.tooLong')

export const assessmentFormSchema = z.object({
  id: z.uuid(),
  kind: z.enum(ASSESSMENT_KINDS),
  title: name(60),
  date: isoDate,
  format: z.enum(EXAM_FORMATS),
  scopeAll: z.boolean(),
  contingent: z.boolean(),
  dateTentative: z.boolean(),
})
export type AssessmentForm = z.infer<typeof assessmentFormSchema>

export const subjectFormSchema = z
  .object({
    id: z.uuid(),
    name: name(80),
    color: z.enum(SUBJECT_COLORS),
    priority: z.number().int().min(1).max(5),
    studyMode: z.enum(STUDY_MODES),
    campaignStartOn: isoDate.nullable(),
    assessments: z.array(assessmentFormSchema),
  })
  .refine((s) => s.studyMode === 'campaign' || s.campaignStartOn === null, {
    path: ['campaignStartOn'],
    message: 'validation.campaignStartOnlyForCampaign',
  })
export type SubjectForm = z.infer<typeof subjectFormSchema>

export const deadlineFormSchema = z.object({
  id: z.uuid(),
  subjectId: z.uuid().nullable(),
  title: name(80),
  kind: z.enum(DEADLINE_KINDS),
  date: isoDate,
  // Optional estimate in hours; with it the deadline enters the plan as `deadline` blocks.
  estHours: z.number().positive('validation.positive').max(200, 'validation.tooLarge').nullable(),
  notes: z.string().trim().max(500, 'validation.tooLong').nullable(),
})
export type DeadlineForm = z.infer<typeof deadlineFormSchema>

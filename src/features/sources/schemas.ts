import { z } from 'zod'
import { MEASURES } from '@/lib/outline/parse'
import { SOURCE_KINDS } from './model'

// Error messages are i18n keys; forms render them with t().
const text = (max: number) =>
  z.string().trim().min(1, 'validation.required').max(max, 'validation.tooLong')
const page = z.number().int().min(0, 'validation.positive').max(100000, 'validation.tooLarge')

export const sourceFormSchema = z
  .object({
    id: z.uuid(),
    subjectId: z.uuid(),
    kind: z.enum(SOURCE_KINDS),
    title: text(120),
    measure: z.enum(MEASURES),
    /** Only for `other` sources measured in items; the starting minutes per unit. */
    minutesPerItem: z
      .number()
      .positive('validation.positive')
      .max(600, 'validation.tooLarge')
      .nullable(),
  })
  .refine((s) => s.measure !== 'items' || s.minutesPerItem !== null, {
    path: ['minutesPerItem'],
    message: 'validation.required',
  })
export type SourceForm = z.infer<typeof sourceFormSchema>

export const OUTLINE_MAX_LENGTH = 30000
export const outlineTextSchema = z
  .string()
  .max(OUTLINE_MAX_LENGTH, 'validation.tooLong')
  .refine((s) => s.trim().length > 0, 'sources.editor.empty')

/** One unit edited in the review list or on the unit page. */
export const unitFormSchema = z
  .object({
    label: text(20),
    title: text(300),
    pageStart: page.nullable(),
    pageEnd: page.nullable(),
  })
  .refine((u) => u.pageStart === null || u.pageEnd === null || u.pageEnd >= u.pageStart, {
    path: ['pageEnd'],
    message: 'validation.pageOrder',
  })
export type UnitForm = z.infer<typeof unitFormSchema>

export const NOTES_MAX_LENGTH = 20000
export const notesSchema = z.string().max(NOTES_MAX_LENGTH, 'validation.tooLong')

export const cardFormSchema = z.object({
  id: z.uuid(),
  unitId: z.uuid(),
  front: text(500),
  back: text(2000),
})
export type CardForm = z.infer<typeof cardFormSchema>

export const topicNameSchema = text(60)

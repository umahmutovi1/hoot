import { z } from 'zod'
import { parseClock, parseEndClock } from '@/lib/schedule'
import { CLASS_KINDS, EXAM_SESSIONS, PERIOD_KINDS } from './model'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date')
/** "HH:mm" from `<input type="time">`, stored as minutes after midnight. */
const clock = z
  .string()
  .min(1, 'validation.required')
  .refine((v) => parseClock(v) !== null, 'validation.time')

const timeOrder = <T extends { start: string; end: string }>(v: T) =>
  (parseEndClock(v.end) ?? 0) > (parseClock(v.start) ?? 0)

export const periodFormSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(PERIOD_KINDS),
    examSession: z.enum(EXAM_SESSIONS).nullable(),
    title: z.string().trim().min(1, 'validation.required').max(60, 'validation.tooLong'),
    startsOn: date,
    endsOn: date,
  })
  .refine((v) => v.endsOn >= v.startsOn, { path: ['endsOn'], message: 'validation.rangeOrder' })
export type PeriodForm = z.infer<typeof periodFormSchema>

export const classFormSchema = z
  .object({
    id: z.uuid(),
    subjectId: z.uuid({ message: 'validation.required' }),
    kind: z.enum(CLASS_KINDS),
    weekday: z.number().int().min(0).max(6),
    start: clock,
    end: clock,
    location: z.string().trim().max(40, 'validation.tooLong'),
    weekParity: z.enum(['all', 'odd', 'even']),
    periodId: z.uuid({ message: 'validation.required' }),
  })
  .refine(timeOrder, { path: ['end'], message: 'validation.timeOrder' })
export type ClassForm = z.infer<typeof classFormSchema>

export const dayFormSchema = z.object({
  slots: z.array(
    z
      .object({ start: clock, end: clock, overClasses: z.boolean() })
      .refine(timeOrder, { path: ['end'], message: 'validation.timeOrder' }),
  ),
  /** Daily study cap in hours (half-hour steps). */
  capHours: z.number().min(0).max(24),
  scope: z.enum(['day', 'weekday']),
})
export type DayForm = z.infer<typeof dayFormSchema>

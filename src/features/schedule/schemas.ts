import { z } from 'zod'
import { parseClock } from '@/lib/schedule'
import { CLASS_KINDS, EXAM_SESSIONS, PERIOD_KINDS } from './model'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date')
/** "HH:mm" from `<input type="time">`, stored as minutes after midnight. */
const clock = z
  .string()
  .min(1, 'validation.required')
  .refine((v) => parseClock(v) !== null, 'validation.time')

const timeOrder = <T extends { start: string; end: string }>(v: T) =>
  (parseClock(v.end) ?? 0) > (parseClock(v.start) ?? 0)

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

export const slotFormSchema = z
  .object({ id: z.uuid(), weekday: z.number().int().min(0).max(6), start: clock, end: clock })
  .refine(timeOrder, { path: ['end'], message: 'validation.timeOrder' })
export type SlotForm = z.infer<typeof slotFormSchema>

export const EXCEPTION_TYPES = ['busyDay', 'busyTime', 'extraFree'] as const
export type ExceptionType = (typeof EXCEPTION_TYPES)[number]

export const exceptionFormSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(EXCEPTION_TYPES),
    onDate: date,
    start: z.string(),
    end: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'busyDay') return
    for (const key of ['start', 'end'] as const) {
      if (!v[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'validation.required' })
      else if (parseClock(v[key]) === null)
        ctx.addIssue({ code: 'custom', path: [key], message: 'validation.time' })
    }
    if (v.start && v.end && !timeOrder(v))
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'validation.timeOrder' })
  })
export type ExceptionForm = z.infer<typeof exceptionFormSchema>

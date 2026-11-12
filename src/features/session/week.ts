import { addDays, type LocalDate } from '@/lib/day'

export interface WeekDay {
  day: LocalDate
  planned: number
  done: number
}

/** Height of the week's bars on the Sesije board, in px. */
export const BAR_HEIGHT = 72

/**
 * Bar heights of a week (board Sesije): planned and done minutes on one scale, the week's largest
 * value, so a day's done bar reads directly against its plan. A planned day never vanishes.
 */
export function weekBars(days: readonly WeekDay[], height = BAR_HEIGHT) {
  const max = Math.max(1, ...days.flatMap((d) => [d.planned, d.done]))
  const px = (m: number) => Math.round((m / max) * height)
  return days.map((d) => ({
    planned: d.planned > 0 ? Math.max(6, px(d.planned)) : 0,
    done: px(d.done),
  }))
}

/** Planned and done minutes per day of the week that starts on `start`. */
export function weekDays(
  start: LocalDate,
  planned: ReadonlyMap<LocalDate, number>,
  done: ReadonlyMap<LocalDate, number>,
): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i)
    return { day, planned: planned.get(day) ?? 0, done: done.get(day) ?? 0 }
  })
}

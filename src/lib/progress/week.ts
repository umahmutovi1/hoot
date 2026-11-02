import { addDays, startOfWeek, weekdayOf, type LocalDate } from '@/lib/day'

/** Sunday reviews the week ending today; later visits review the last completed week. */
export function weekWindow(today: LocalDate) {
  const monday = startOfWeek(today)
  const from = weekdayOf(today) === 6 ? monday : addDays(monday, -7)
  const nextFrom = addDays(from, 7)
  return {
    from,
    to: addDays(from, 6),
    previousFrom: addDays(from, -7),
    previousTo: addDays(from, -1),
    nextFrom,
    nextTo: addDays(nextFrom, 6),
  }
}
export function recallShare(rows: readonly { mode: string | null; minutes: number }[]) {
  const total = rows.reduce((s, r) => s + r.minutes, 0)
  return total > 0
    ? rows.reduce(
        (s, r) => s + (['review', 'questions', 'problems'].includes(r.mode ?? '') ? r.minutes : 0),
        0,
      ) / total
    : null
}

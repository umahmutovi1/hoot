import type { LocalDate } from '@/lib/day'

type Period = { kind: string; startsOn: LocalDate; endsOn: LocalDate }
/** Sprint 17: exam periods have their own measurements; outside them, use teaching history. */
export function studyPeriod(on: LocalDate, periods: readonly Period[]): 'exam' | 'teaching' {
  return periods.some((p) => p.kind === 'exam' && p.startsOn <= on && p.endsOn >= on)
    ? 'exam'
    : 'teaching'
}
export function sameStudyPeriod<T extends { onDate: LocalDate }>(
  rows: T[],
  today: LocalDate,
  periods: readonly Period[],
): T[] {
  const current = studyPeriod(today, periods)
  return rows.filter((r) => studyPeriod(r.onDate, periods) === current)
}

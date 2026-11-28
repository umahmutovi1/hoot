/** How long after an exam Danas keeps asking for its result. */
export const RESULT_ASK_DAYS = 30

interface ExamLike {
  id: string
  at: string
  result_points: number | null
  result_annulled: boolean
  passed: boolean
  archived_at: string | null
}

/**
 * Exams whose day is over and that still have no result, newest first: Danas asks "Kako je
 * prošao …?" for them. `localDate` turns the exam's timestamp into a local `yyyy-MM-dd`;
 * `snoozedUntil` is the "Kasnije" map (key `result:<id>`, inclusive local day).
 */
export function examsAwaitingResult<E extends ExamLike>(
  exams: E[],
  today: string,
  localDate: (iso: string) => string,
  snoozedUntil: Record<string, string> = {},
): E[] {
  const oldest = shiftDay(today, -RESULT_ASK_DAYS)
  return exams
    .filter((e) => {
      if (e.archived_at || e.result_annulled || e.passed || e.result_points !== null) return false
      const day = localDate(e.at)
      if (day >= today || day < oldest) return false
      const until = snoozedUntil[resultKey(e.id)]
      return !until || until < today
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1))
}

export const resultKey = (examId: string) => `result:${examId}`

function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d! + days))
  return date.toISOString().slice(0, 10)
}

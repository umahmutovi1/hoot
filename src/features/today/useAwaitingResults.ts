import { usePlanUi } from '@/features/plan/ui'
import { useSubjects } from '@/features/subjects/api'
import { localDateOf } from '@/features/subjects/model'
import { examsAwaitingResult } from './results'

/** The exams on Danas that wait for a result, as one hook so ActionCards can count them. */
export function useAwaitingResults(today: string) {
  const { data: subjects = [] } = useSubjects()
  const snoozed = usePlanUi((s) => s.snoozed)
  const exams = subjects
    .filter((s) => !s.archived)
    .flatMap((s) => s.assessments.map((a) => ({ ...a, subject: s })))
  return examsAwaitingResult(exams, today, localDateOf, snoozed)
}

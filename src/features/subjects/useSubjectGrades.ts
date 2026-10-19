import type { TFunction } from 'i18next'
import { entryConditions, project, type GradeStatus } from '@/lib/grades'
import { gradeItemsOf, gradeSubjectOf, pointsLabel } from './grades'
import type { Deadline, SubjectWithAssessments } from './model'

/** Projection and entry conditions of one subject (exams + its deadlines). */
export function useSubjectGrades(subject: SubjectWithAssessments, deadlines: Deadline[]) {
  const items = gradeItemsOf(subject, deadlines)
  const projection = project(items, gradeSubjectOf(subject))
  const titles = new Map<string, string>([
    ...subject.assessments.map((a) => [a.id, a.title] as const),
    ...deadlines.map((d) => [d.id, d.title] as const),
  ])
  const entries = entryConditions(items, subject.points_total).filter((e) => {
    const exam = subject.assessments.find((a) => a.id === e.itemId)
    // Only exams still ahead: the condition no longer matters once there is a result.
    return e.missing > 0 && exam?.result_points === null
  })
  return { projection, titles, entries, hasPoints: projection.slots.length > 0 }
}

/** "Za 8 treba ti još 29 bodova" / "8 je osigurana" / "8 više nije dostižna". */
export function targetLine(t: TFunction, status: GradeStatus, locale: string) {
  if (status.kind === 'secured') return t('grades.card.targetSecured', { grade: status.grade })
  if (status.kind === 'unreachable')
    return t('grades.card.targetUnreachable', { grade: status.grade })
  return t('grades.card.targetNeeds', {
    grade: status.grade,
    points: pointsLabel(t, status.points, locale),
  })
}

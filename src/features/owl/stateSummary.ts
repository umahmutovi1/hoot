import { MAX_STATE_CHARS } from '@shared/schemas.ts'
import { project } from '@/lib/grades'
import { gradeItemsOf, gradeSubjectOf, type GlobalScale } from '@/features/subjects/grades'
import { localDateOf, type Deadline, type SubjectWithAssessments } from '@/features/subjects/model'

interface PeriodLike {
  kind: string
  exam_session: string | null
  title: string
  starts_on: string
  ends_on: string
}

/**
 * Compact JSON of the plan state for the owl's answers (PRD "Stanje plana"): subjects, exams,
 * deadlines, points and the academic calendar. Only what an answer can need, no ids or notes.
 */
export function buildStateSummary(input: {
  today: string
  subjects: SubjectWithAssessments[]
  deadlines: Deadline[]
  periods: PeriodLike[]
  globalScale: GlobalScale | undefined
}): string {
  const subjects = input.subjects
    .filter((s) => !s.archived)
    .map((s) => {
      const items = gradeItemsOf(s, input.deadlines)
      const grading = gradeSubjectOf(s, input.globalScale)
      const projection = project(items, grading)
      const target = s.target_grade
        ? projection.grades.find((g) => g.grade === s.target_grade)
        : undefined
      return {
        name: s.name,
        priority: s.priority,
        exams: [...s.assessments]
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((a) => ({
            title: a.title,
            kind: a.kind,
            date: localDateOf(a.at),
            ...(a.date_tentative
              ? { tentative: true, latest: a.at_latest ? localDateOf(a.at_latest) : null }
              : {}),
            ...(a.contingent ? { only_if_needed: true } : {}),
            ...(a.passed ? { passed: true } : {}),
            ...(a.result_points !== null ? { result: `${a.result_points}/${a.result_max}` } : {}),
            ...(a.points_max !== null ? { points_max: a.points_max } : {}),
          })),
        deadlines: input.deadlines
          .filter((d) => d.subject_id === s.id && !d.done)
          .map((d) => ({ title: d.title, due: localDateOf(d.due_at) })),
        ...(projection.slots.length > 0
          ? {
              points: {
                have: projection.have,
                possible_so_far: projection.maxSoFar,
                still_open: projection.remaining,
                total: grading.pointsTotal,
                grades: projection.grades.map((g) =>
                  g.kind === 'needs' ? `${g.grade}: needs ${g.points}` : `${g.grade}: ${g.kind}`,
                ),
                ...(target ? { target_grade: s.target_grade } : {}),
              },
            }
          : {}),
      }
    })
  const summary = {
    today: input.today,
    calendar: input.periods.map((p) => ({
      kind: p.exam_session ? `${p.kind}:${p.exam_session}` : p.kind,
      title: p.title,
      from: p.starts_on,
      to: p.ends_on,
    })),
    subjects,
    other_deadlines: input.deadlines
      .filter((d) => d.subject_id === null && !d.done)
      .map((d) => ({ title: d.title, due: localDateOf(d.due_at) })),
  }
  let json = JSON.stringify(summary)
  // Keep inside the request limit: drop past calendar entries, then trim exams lists.
  if (json.length > MAX_STATE_CHARS) {
    summary.calendar = summary.calendar.filter((p) => p.to >= input.today)
    json = JSON.stringify(summary)
  }
  return json.length > MAX_STATE_CHARS ? json.slice(0, MAX_STATE_CHARS) : json
}

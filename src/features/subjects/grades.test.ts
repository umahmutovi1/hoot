import { describe, expect, it } from 'vitest'
import { project } from '@/lib/grades'
import { assessmentRow, deadlineRow, subjectRow } from './fixtures'
import { gradeItemsOf, gradeSubjectOf, parseScale, worthOf } from './grades'

describe('grade items from rows', () => {
  const p1 = assessmentRow({
    id: 'p1',
    points_max: 40,
    result_points: 32,
    result_max: 40,
    passed: true,
  })
  const makeup = assessmentRow({ id: 'm', kind: 'makeup', retake_of: 'p1' })
  const hw = deadlineRow({ id: 'hw', subject_id: 's', points_max: 14, points_unit: 'percent' })
  const other = deadlineRow({ id: 'x', subject_id: 'other', points_max: 50 })
  const subject = { ...subjectRow(), assessments: [p1, makeup] }

  it('takes the subject exams and only its deadlines', () => {
    const items = gradeItemsOf(subject, [hw, other])
    expect(items.map((i) => i.id)).toEqual(['p1', 'm', 'hw'])
    expect(worthOf('m', items, 100)).toBe(40)
    expect(worthOf('hw', items, 50)).toBe(7)
    expect(project(items, gradeSubjectOf(subject, undefined)).have).toBe(32)
  })

  it('reads a stored scale and falls back to the default', () => {
    expect(parseScale([50, 60, 70, 80, 90])).toEqual([50, 60, 70, 80, 90])
    expect(parseScale([50, 40, 70, 80, 90])).toBeNull()
    expect(parseScale(null)).toBeNull()
    expect(gradeSubjectOf(subjectRow(), undefined).scale).toEqual([55, 65, 75, 85, 95])
  })

  it('uses the global scale unless the subject has its own', () => {
    const global = { points_total: 60, grade_scale: [50, 60, 70, 80, 90] }
    const own = subjectRow({ custom_scale: true, points_total: 40, grade_scale: null })
    expect(gradeSubjectOf(subjectRow(), global)).toEqual({
      pointsTotal: 60,
      scale: [50, 60, 70, 80, 90],
    })
    expect(gradeSubjectOf(own, global)).toEqual({
      pointsTotal: 40,
      scale: [55, 65, 75, 85, 95],
    })
  })
})

import { describe, expect, it } from 'vitest'
import { assessmentRow, deadlineRow, subjectRow } from '@/features/subjects/fixtures'
import { buildStateSummary } from './stateSummary'

describe('buildStateSummary', () => {
  const subject = {
    ...subjectRow({ id: 's1', name: 'Signali i sistemi', target_grade: 8 }),
    assessments: [
      assessmentRow({
        id: 'a2',
        subject_id: 's1',
        title: 'II parcijala',
        at: '2026-12-03T08:00:00Z',
        points_max: 50,
      }),
      assessmentRow({
        id: 'a1',
        subject_id: 's1',
        title: 'I parcijala',
        at: '2026-10-28T08:00:00Z',
        points_max: 50,
        result_points: 40,
        result_max: 50,
        passed: true,
      }),
    ],
  }

  it('lists subjects, exams in date order, points and the calendar, without ids', () => {
    const json = buildStateSummary({
      today: '2026-10-20',
      subjects: [
        subject,
        { ...subjectRow({ id: 's2', name: 'Arhiva', archived: true }), assessments: [] },
      ],
      deadlines: [
        deadlineRow({ id: 'd1', subject_id: 's1', title: 'Zadaća 2', done: false }),
        deadlineRow({ id: 'd2', subject_id: null, title: 'Upis', done: true }),
      ],
      globalScale: undefined,
      periods: [
        {
          kind: 'exam',
          exam_session: 'makeup',
          title: 'Popravni rok',
          starts_on: '2027-02-15',
          ends_on: '2027-02-26',
        },
      ],
    })
    const state = JSON.parse(json)
    expect(state.subjects).toHaveLength(1)
    const s = state.subjects[0]
    expect(s.exams.map((e: { title: string }) => e.title)).toEqual(['I parcijala', 'II parcijala'])
    expect(s.exams[0]).toMatchObject({ result: '40/50', passed: true })
    expect(s.points).toMatchObject({ have: 40, total: 100, target_grade: 8 })
    expect(s.deadlines.map((d: { title: string }) => d.title)).toEqual(['Zadaća 2'])
    expect(state.other_deadlines).toEqual([])
    expect(state.calendar[0]).toEqual({
      kind: 'exam:makeup',
      title: 'Popravni rok',
      from: '2027-02-15',
      to: '2027-02-26',
    })
    expect(json).not.toContain('s1')
  })
})

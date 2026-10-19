import { describe, expect, it } from 'vitest'
import { examAtFromDate, dueAtFromDate, type Deadline } from '@/features/subjects/model'
import { deadlinesAhead, deadlinesOn, examsOn, monthGrid, possibleExamsOn } from './calendar'

const deadline = (id: string, date: string, done = false): Deadline => ({
  id,
  user_id: 'u',
  subject_id: null,
  title: id,
  kind: 'custom',
  due_at: dueAtFromDate(date),
  est_minutes: null,
  done_minutes: 0,
  notes: null,
  done,
  created_at: '',
  updated_at: '',
})

describe('monthGrid', () => {
  it('October 2026 starts on Monday 28 Sep and ends on Sunday 1 Nov', () => {
    const cells = monthGrid(new Date(2026, 9, 15))
    expect(cells).toHaveLength(35)
    expect(cells[0]?.date).toEqual(new Date(2026, 8, 28))
    expect(cells[0]?.inMonth).toBe(false)
    expect(cells[3]?.date).toEqual(new Date(2026, 9, 1))
    expect(cells[34]?.date).toEqual(new Date(2026, 10, 1))
  })

  it('always has whole weeks', () => {
    for (let m = 0; m < 12; m++) expect(monthGrid(new Date(2027, m, 1)).length % 7).toBe(0)
  })
})

describe('day events', () => {
  const subject = (archived: boolean) => ({
    id: archived ? 'old' : 's',
    user_id: 'u',
    name: 'Signali',
    color: 'pink',
    archived,
    priority: 3,
    study_mode: 'regular',
    campaign_start_on: null,
    created_at: '',
    updated_at: '',
    assessments: [
      {
        id: archived ? 'x' : 'a',
        user_id: 'u',
        subject_id: 's',
        kind: 'partial' as const,
        title: 'I parcijala',
        at: examAtFromDate('2026-10-28'),
        format: 'written' as const,
        weight_pct: null,
        scope_all: false,
        passed: false,
        readiness_before: null,
        result_points: null,
        result_max: null,
        contingent: false,
        date_tentative: false,
        at_latest: null as string | null,
        created_at: '',
        updated_at: '',
      },
    ],
  })

  it('lists exams of active subjects on the day', () => {
    const found = examsOn(new Date(2026, 9, 28), [subject(false), subject(true)])
    expect(found.map((e) => e.exam.id)).toEqual(['a'])
    expect(examsOn(new Date(2026, 9, 27), [subject(false)])).toEqual([])
  })

  it('spreads a tentative exam with a range over every day of the range', () => {
    const s = subject(false)
    s.assessments[0] = {
      ...s.assessments[0]!,
      date_tentative: true,
      at: examAtFromDate('2026-12-01'),
      at_latest: examAtFromDate('2026-12-03'),
    }
    expect(examsOn(new Date(2026, 11, 1), [s])).toEqual([])
    const days = [30, 1, 2, 3, 4].map((d) =>
      d === 30 ? new Date(2026, 10, 30) : new Date(2026, 11, d),
    )
    expect(days.map((d) => possibleExamsOn(d, [s]).length)).toEqual([0, 1, 1, 1, 0])
  })

  it('finds deadlines on the day and open ones within a week', () => {
    const list = [
      deadline('today', '2026-10-19'),
      deadline('friday', '2026-10-23'),
      deadline('done', '2026-10-22', true),
      deadline('far', '2026-11-05'),
      deadline('past', '2026-10-18'),
    ]
    const day = new Date(2026, 9, 19)
    expect(deadlinesOn(day, list).map((d) => d.id)).toEqual(['today'])
    expect(deadlinesAhead(day, list).map((d) => d.id)).toEqual(['today', 'friday'])
  })
})

import { describe, expect, it } from 'vitest'
import { assessmentRow, deadlineRow, subjectRow } from '@/features/subjects/fixtures'
import {
  examAtFromDate,
  dueAtFromDate,
  type SubjectWithAssessments,
} from '@/features/subjects/model'
import {
  dayMarkers,
  deadlinesAhead,
  deadlinesOn,
  examsOn,
  hourRange,
  layoutLanes,
  monthGrid,
  possibleExamsOn,
} from './calendar'

const deadline = (id: string, date: string, done = false) =>
  deadlineRow({ id, title: id, due_at: dueAtFromDate(date), done })

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
  const subject = (archived: boolean): SubjectWithAssessments => ({
    ...subjectRow({ id: archived ? 'old' : 's', archived }),
    assessments: [assessmentRow({ id: archived ? 'x' : 'a', at: examAtFromDate('2026-10-28') })],
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

  it('marks every exam and deadline of the day, with "+N" past three', () => {
    const day = new Date(2026, 9, 28)
    const s = subject(false)
    const second = {
      ...s,
      id: 's2',
      color: 'blue',
      assessments: [{ ...s.assessments[0]!, id: 'b' }],
    }
    const one = dayMarkers(day, [s, second], [deadline('d', '2026-10-28')])
    expect(one.visible.map((m) => [m.kind, m.id])).toEqual([
      ['exam', 'a'],
      ['exam', 'b'],
      ['deadline', 'd'],
    ])
    expect(one.more).toBe(0)
    const many = dayMarkers(
      day,
      [s, second],
      [deadline('d', '2026-10-28'), deadline('e', '2026-10-28')],
    )
    expect(many.visible.map((m) => m.id)).toEqual(['a', 'b'])
    expect(many.more).toBe(2)
    expect(dayMarkers(new Date(2026, 9, 27), [s], []).visible).toEqual([])
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

describe('layoutLanes', () => {
  const at = (id: string, s: number, e: number) => ({ id, startMin: s, endMin: e })

  it('keeps separate items in one lane', () => {
    const placed = layoutLanes([at('a', 540, 660), at('b', 780, 960)])
    expect(placed.map((p) => [p.item.id, p.lane, p.lanes])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ])
  })

  it('splits overlapping items and reuses a freed lane', () => {
    const placed = layoutLanes([at('a', 540, 660), at('b', 600, 720), at('c', 660, 700)])
    expect(placed.map((p) => [p.item.id, p.lane, p.lanes])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 2],
    ])
  })
})

describe('hourRange', () => {
  it('defaults to 08–20 and widens for early or late items', () => {
    expect(hourRange([])).toEqual([8, 20])
    expect(hourRange([{ id: 'x', startMin: 7 * 60 + 30, endMin: 21 * 60 + 15 }])).toEqual([7, 22])
  })
})

import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { eveCandidate, plan, reservedDays, type PlanGoal } from '.'
import { days, exam, FROM, state, subject, units } from './fixtures'

const day = (n: number) => addDays(FROM, n)

/** Two subjects with plenty of work: A has an exam on day 10, B on day 20. */
function twoSubjects(over: { a?: Partial<PlanGoal>; b?: Partial<PlanGoal> } = {}) {
  const ua = units('a', 8, 90, { level: 1, nextReviewOn: day(5) })
  const ub = units('b', 40, 90)
  return state({
    subjects: [subject('a'), subject('b')],
    units: [...ua, ...ub],
    goals: [
      {
        ...exam(
          'ga',
          'a',
          day(10),
          ua.map((u) => u.id),
        ),
        ...over.a,
      },
      {
        ...exam(
          'gb',
          'b',
          day(20),
          ub.map((u) => u.id),
        ),
        ...over.b,
      },
    ],
  })
}

describe('reserved day before an exam', () => {
  it('holds only that subject; without a reservation others study there too', () => {
    const free = plan(twoSubjects())
    expect(free.blocks.some((b) => b.onDate === day(9) && b.subjectId === 'b')).toBe(true)

    const s = twoSubjects({ a: { eveReserved: true, atMin: 600 } })
    expect([...reservedDays(s)]).toEqual([[day(9), s.goals[0]]])
    const r = plan(s)
    const eve = r.blocks.filter((b) => b.onDate === day(9))
    expect(eve.length).toBeGreaterThan(0)
    expect(eve.every((b) => b.subjectId === 'a')).toBe(true)
    expect(eve.every((b) => b.kind === 'review' || b.kind === 'questions')).toBe(true)
  })

  it('gives the exam the whole day for its reviews and questions', () => {
    const minutes = (r: ReturnType<typeof plan>) =>
      r.blocks.filter((b) => b.onDate === day(9)).reduce((s, b) => s + b.minutes, 0)
    const without = plan(twoSubjects())
    const withEve = plan(twoSubjects({ a: { eveReserved: true, atMin: 600 } }))
    const aOnly = (r: ReturnType<typeof plan>) =>
      r.blocks
        .filter((b) => b.onDate === day(9) && b.subjectId === 'a')
        .reduce((s, b) => s + b.minutes, 0)
    expect(aOnly(withEve)).toBeGreaterThan(aOnly(without))
    expect(minutes(withEve)).toBeGreaterThan(0)
  })

  it('a review of another subject due there comes earlier, never after its own exam', () => {
    const ua = units('a', 4, 60, { level: 1 })
    const ub = units('b', 2, 30, { level: 1, nextReviewOn: day(9) })
    const s = state({
      subjects: [subject('a'), subject('b')],
      units: [...ua, ...ub],
      settings: { ...state().settings, bufferDays: 0 },
      goals: [
        {
          ...exam(
            'ga',
            'a',
            day(10),
            ua.map((u) => u.id),
          ),
          eveReserved: true,
          atMin: 540,
        },
        // B's exam is the same day, later: its last review day (9) belongs to A.
        exam(
          'gb',
          'b',
          day(10),
          ub.map((u) => u.id),
        ),
      ],
    })
    const r = plan(s)
    const reviewsB = r.blocks.filter((b) => b.subjectId === 'b' && b.kind === 'review')
    expect(reviewsB.length).toBeGreaterThan(0)
    expect(reviewsB.every((b) => b.onDate === day(8))).toBe(true)
  })

  it('a review of another subject with a later exam moves to the next day', () => {
    const ua = units('a', 4, 60, { level: 1 })
    const ub = units('b', 2, 30, { level: 1, nextReviewOn: day(9) })
    const s = state({
      subjects: [subject('a'), subject('b')],
      units: [...ua, ...ub],
      goals: [
        {
          ...exam(
            'ga',
            'a',
            day(10),
            ua.map((u) => u.id),
          ),
          eveReserved: true,
          atMin: 540,
        },
        exam(
          'gb',
          'b',
          day(20),
          ub.map((u) => u.id),
        ),
      ],
    })
    const reviewsB = plan(s).blocks.filter((b) => b.subjectId === 'b' && b.kind === 'review')
    expect(reviewsB.map((b) => b.onDate)).toEqual([day(10)])
  })

  it('two exams with the same last day: the closer one keeps it, the other takes the day before', () => {
    const s = twoSubjects({
      a: { eveReserved: true, atMin: 540 },
      b: { on: day(10), eveReserved: true, atMin: 840 },
    })
    const reserved = reservedDays(s)
    expect(reserved.get(day(9))?.id).toBe('ga')
    expect(reserved.get(day(8))?.id).toBe('gb')
    const r = plan(s)
    expect(r.blocks.filter((b) => b.onDate === day(8)).every((b) => b.subjectId === 'b')).toBe(true)
  })

  it('the card knows which day it would get and who holds the last one', () => {
    const s = twoSubjects({ a: { eveReserved: true, atMin: 540 }, b: { on: day(10), atMin: 840 } })
    expect(eveCandidate(s, 'gb')).toEqual({
      day: day(8),
      takenBy: s.goals[0],
      lastStudyDay: day(9),
    })
    expect(eveCandidate(s, 'ga')).toEqual({ day: day(9), takenBy: null, lastStudyDay: day(9) })
  })

  it('skips a day without study time and never reserves a day before the plan starts', () => {
    const s = twoSubjects({ a: { eveReserved: true, atMin: 540 } })
    const noStudy = { ...s, days: days(28).map((d, i) => (i === 9 ? { ...d, cap: 0 } : d)) }
    expect([...reservedDays(noStudy).keys()]).toEqual([day(8)])
    const tomorrow = twoSubjects({ a: { on: day(0), eveReserved: true } })
    expect(reservedDays(tomorrow).size).toBe(0)
  })
})

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { planIntervalMin } from '@/lib/session/timer'
import { feasibility, plan, type PlanState } from '.'
import { days, exam, FROM, state, subject, units } from './fixtures'

const deficitOf = (s: PlanState) => plan(s).deficits.reduce((sum, d) => sum + d.minutes, 0)

describe('feasibility', () => {
  it('work that fits before the exam is feasible', () => {
    const s = state({
      days: days(10, [{ startMin: 9 * 60, endMin: 12 * 60 }], 120),
      subjects: [subject('a')],
      units: units('a', 4, 60),
      goals: [
        exam(
          'e',
          'a',
          addDays(FROM, 9),
          units('a', 4).map((u) => u.id),
        ),
      ],
    })
    expect(feasibility(s)).toMatchObject({ feasible: true, shortfall: 0, tightest: null })
  })

  it('the shortfall is what no plan can fit, with the tightest interval', () => {
    // 2 days to learn (exam on day 3, buffer 1) × 60 min against 300 min of work.
    const s = state({
      days: days(6, [{ startMin: 9 * 60, endMin: 10 * 60 }], 60),
      subjects: [subject('a', { priority: 1 })],
      units: units('a', 5, 60),
      goals: [
        exam(
          'e',
          'a',
          addDays(FROM, 3),
          units('a', 5).map((u) => u.id),
        ),
      ],
    })
    const f = feasibility(s)
    expect(f.feasible).toBe(false)
    expect(f.tightest).toMatchObject({ from: FROM, to: addDays(FROM, 1) })
    expect(f.shortfall).toBe(f.tightest!.need - f.tightest!.capacity)
    expect(deficitOf(s)).toBeGreaterThanOrEqual(f.shortfall)
  })

  it('two exams: the earlier one cannot borrow the later days', () => {
    const one = units('a', 3, 60)
    const two = units('b', 3, 60)
    const s = state({
      days: days(8, [{ startMin: 9 * 60, endMin: 11 * 60 }], 120),
      subjects: [subject('a'), subject('b')],
      units: [...one, ...two],
      goals: [
        exam(
          'ea',
          'a',
          addDays(FROM, 2),
          one.map((u) => u.id),
        ),
        exam(
          'eb',
          'b',
          addDays(FROM, 7),
          two.map((u) => u.id),
        ),
      ],
    })
    const f = feasibility(s)
    expect(f.tightest?.to).toBe(FROM)
    expect(f.feasible).toBe(false)
  })

  it('an exam with no day left to learn is all shortfall', () => {
    const s = state({
      days: days(3),
      subjects: [subject('a')],
      units: units('a', 2, 40),
      goals: [
        exam(
          'e',
          'a',
          FROM,
          units('a', 2).map((u) => u.id),
        ),
      ],
    })
    const f = feasibility(s)
    expect(f.feasible).toBe(false)
    expect(f.windows[0]!.last).toBeLessThan(f.windows[0]!.first)
  })

  it('a manual campaign start is a release day', () => {
    const s = state({
      days: days(10, [{ startMin: 9 * 60, endMin: 10 * 60 }], 60),
      subjects: [subject('a', { mode: 'campaign', campaignStartOn: addDays(FROM, 6) })],
      units: units('a', 4, 60),
      goals: [
        exam(
          'e',
          'a',
          addDays(FROM, 9),
          units('a', 4).map((u) => u.id),
        ),
      ],
    })
    expect(feasibility(s).windows[0]!.first).toBe(6)
    expect(feasibility(s).feasible).toBe(false)
  })
})

// States where the relaxation matches plan(): regular subjects, no reviews or lectures, every
// subject may appear on a day, no reserved eves.
const DAYS = 18
const stateArb = fc
  .record({
    subjects: fc.integer({ min: 1, max: 4 }),
    units: fc.array(
      fc.record({ s: fc.integer({ min: 0, max: 3 }), minutes: fc.integer({ min: 2, max: 18 }) }),
      { minLength: 1, maxLength: 24 },
    ),
    exams: fc.array(fc.integer({ min: 2, max: DAYS - 1 }), { minLength: 4, maxLength: 4 }),
    caps: fc.array(fc.integer({ min: 0, max: 8 }), { minLength: DAYS, maxLength: DAYS }),
    priorities: fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 4, maxLength: 4 }),
  })
  .map((x): PlanState => {
    const ids = Array.from({ length: x.subjects }, (_, i) => `s${i}`)
    const all = x.units.map((u, i) => ({
      ...units(ids[u.s % x.subjects]!, 1, u.minutes * 10)[0]!,
      id: `u${String(i).padStart(2, '0')}`,
      order: i,
    }))
    return state({
      days: days(DAYS, [{ startMin: 8 * 60, endMin: 22 * 60 }]).map((d, i) => ({
        ...d,
        cap: x.caps[i]! * 30,
      })),
      subjects: ids.map((id, i) => subject(id, { priority: x.priorities[i]! })),
      units: all,
      goals: ids.map((id, i) =>
        exam(
          `e${i}`,
          id,
          addDays(FROM, x.exams[i]!),
          all.filter((u) => u.subjectId === id).map((u) => u.id),
        ),
      ),
      settings: { ...state().settings, maxSubjectsPerDay: 4, minBlockMinutes: 10 },
    })
  })

describe('feasibility properties', () => {
  it('no plan beats the shortfall', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        expect(deficitOf(s)).toBeGreaterThanOrEqual(feasibility(s).shortfall - 1)
      }),
      { numRuns: 150 },
    )
  })

  // Feasible ⇒ no deficit beyond what the block rules drop (whole study intervals, minimum
  // block): before the EDF guard 11% of feasible states lost ~1% of their work; now a remainder
  // under half an interval per goal is all that is left.
  it('feasible ⇒ plan() without a deficit (up to block remainders)', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        if (!feasibility(s).feasible) return
        const half = planIntervalMin(s.preset) / 2
        for (const d of plan(s).deficits) expect(d.minutes).toBeLessThan(half)
      }),
      { numRuns: 300 },
    )
  })
})

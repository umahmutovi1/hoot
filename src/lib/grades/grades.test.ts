import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  contribution,
  DEFAULT_SCALE,
  entryConditions,
  gradeFor,
  isValidScale,
  itemWorth,
  project,
  retakeStatus,
  slotsOf,
  suggestPassed,
  type GradeItem,
  type GradeSubject,
} from '.'

let n = 0
const item = (over: Partial<GradeItem>): GradeItem => ({
  id: `i${++n}`,
  kind: 'partial',
  at: '2026-11-01T09:00:00Z',
  pointsMax: null,
  pointsUnit: 'points',
  passMinPct: null,
  entryMinPoints: null,
  retakeOf: null,
  resultPoints: null,
  resultMax: null,
  annulled: false,
  passed: null,
  ...over,
})
const subject: GradeSubject = { pointsTotal: 100, scale: null }

// The mockup subject: I parcijala 32/40 (prag 50%), zadaće 14% (14/14), II parcijala 40 open
// (prag 50%), seminarski 6 open.
function mockupItems() {
  const p1 = item({
    id: 'p1',
    at: '2026-10-28T09:00:00Z',
    pointsMax: 40,
    passMinPct: 50,
    resultPoints: 32,
    resultMax: 40,
    passed: true,
  })
  const hw = item({
    id: 'hw',
    kind: 'deadline',
    at: '2026-10-23T21:59:00Z',
    pointsMax: 14,
    pointsUnit: 'percent',
    resultPoints: 14,
    resultMax: 14,
  })
  const p2 = item({ id: 'p2', at: '2026-12-01T09:00:00Z', pointsMax: 40, passMinPct: 50 })
  const sem = item({ id: 'sem', kind: 'deadline', at: '2027-01-12T22:59:00Z', pointsMax: 6 })
  return [p1, hw, p2, sem]
}

describe('scale', () => {
  it('maps percentages to the default Bosnian scale', () => {
    expect(gradeFor(54.9, DEFAULT_SCALE)).toBe(5)
    expect(gradeFor(55, DEFAULT_SCALE)).toBe(6)
    expect(gradeFor(74, DEFAULT_SCALE)).toBe(7)
    expect(gradeFor(95, DEFAULT_SCALE)).toBe(10)
  })

  it('accepts only five strictly increasing thresholds', () => {
    expect(isValidScale([55, 65, 75, 85, 95])).toBe(true)
    expect(isValidScale([55, 65, 65, 85, 95])).toBe(false)
    expect(isValidScale([55, 65, 75, 85])).toBe(false)
    expect(isValidScale([0, 65, 75, 85, 95])).toBe(false)
    expect(isValidScale([55, 65, 75, 85, 101])).toBe(false)
  })
})

describe('worth and contribution', () => {
  it('converts a share of the grade into points of the total', () => {
    const hw = item({ kind: 'deadline', pointsMax: 20, pointsUnit: 'percent' })
    expect(itemWorth(hw, [hw], 60)).toBe(12)
  })

  it('rescales a test marked out of a different maximum', () => {
    expect(contribution(40, { resultPoints: 40, resultMax: 50 })).toBe(32)
  })

  it('gives a makeup the points of the exam it repeats', () => {
    const p = item({ pointsMax: 40 })
    const m = item({ kind: 'makeup', retakeOf: p.id, pointsMax: 10 })
    expect(itemWorth(m, [p, m], 100)).toBe(40)
  })

  it('gives the integral the sum of the partials', () => {
    const p1 = item({ pointsMax: 40 })
    const p2 = item({ pointsMax: 35 })
    const i = item({ kind: 'integral', pointsMax: null })
    expect(itemWorth(i, [p1, p2, i], 100)).toBe(75)
  })

  it('leaves items without points out', () => {
    const exam = item({ kind: 'final' })
    expect(slotsOf([exam], 100)).toEqual([])
  })
})

describe('project', () => {
  it('matches the mockup: 46 of 54 so far, 46 left', () => {
    const p = project(mockupItems(), subject)
    expect(p.have).toBe(46)
    expect(p.maxSoFar).toBe(54)
    expect(p.remaining).toBe(46)
    expect(p.maxPossible).toBe(92)
    expect(p.remainingSlots.map((s) => s.itemId)).toEqual(['p2', 'sem'])
    const eight = p.grades.find((g) => g.grade === 8)
    expect(eight).toMatchObject({ kind: 'needs', points: 29 })
    expect(eight?.kind === 'needs' && Math.round(eight.pct * 100)).toBe(63)
    expect(p.grades.find((g) => g.grade === 10)).toMatchObject({ kind: 'unreachable' })
  })

  it('never asks for less than the thresholds of the remaining items', () => {
    // 55 − 46 = 9, but II parcijala alone needs 20 (50% of 40).
    const six = project(mockupItems(), subject).grades[0]
    expect(six).toMatchObject({ grade: 6, kind: 'needs', points: 20 })
  })

  it('marks grades reached by counted points as secured', () => {
    const exam = item({ kind: 'final', pointsMax: 100, resultPoints: 80, resultMax: 100 })
    const grades = project([exam], subject).grades
    expect(grades.filter((g) => g.kind === 'secured').map((g) => g.grade)).toEqual([6, 7, 8])
    expect(grades.filter((g) => g.kind === 'unreachable').map((g) => g.grade)).toEqual([9, 10])
  })

  it('leaves a result below the threshold out of the sum and its points to win', () => {
    const p1 = item({ pointsMax: 40, passMinPct: 50, resultPoints: 12, resultMax: 40 })
    const p = project([p1], subject)
    expect(p.slots[0]?.state).toBe('failed')
    expect(p.have).toBe(0)
    expect(p.remaining).toBe(40)
  })

  it('respects a manual "passed" over the threshold', () => {
    const p1 = item({
      pointsMax: 40,
      passMinPct: 50,
      resultPoints: 12,
      resultMax: 40,
      passed: true,
    })
    expect(project([p1], subject).have).toBe(12)
  })

  it('leaves a waived result out of the sum', () => {
    const p1 = item({ pointsMax: 40, resultPoints: 30, resultMax: 40, annulled: true })
    const p = project([p1], subject)
    expect(p.have).toBe(0)
    expect(p.slots[0]?.state).toBe('open')
  })

  it('uses a custom scale and total', () => {
    const exam = item({ kind: 'final', pointsMax: 60 })
    const p = project([exam], { pointsTotal: 60, scale: [50, 60, 70, 80, 90] })
    expect(p.grades[0]).toMatchObject({ kind: 'needs', points: 30, pct: 0.5 })
  })
})

describe('latest attempt', () => {
  it('counts the makeup when it is the latest attempt, even if lower', () => {
    const p = item({ pointsMax: 40, resultPoints: 30, resultMax: 40, at: '2026-11-01T09:00:00Z' })
    const m = item({
      kind: 'makeup',
      retakeOf: p.id,
      resultPoints: 24,
      resultMax: 40,
      at: '2027-02-15T09:00:00Z',
    })
    const slots = slotsOf([p, m], 100)
    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({ itemId: p.id, attemptId: m.id, earned: 24 })
  })

  it('falls back to the exam when the makeup is waived', () => {
    const p = item({ pointsMax: 40, resultPoints: 30, resultMax: 40 })
    const m = item({
      kind: 'makeup',
      retakeOf: p.id,
      resultPoints: 10,
      resultMax: 40,
      annulled: true,
      at: '2027-02-15T09:00:00Z',
    })
    expect(slotsOf([p, m], 100)[0]).toMatchObject({ attemptId: p.id, earned: 30 })
  })

  it('lets the integral replace the partials when it is the latest attempt', () => {
    const p1 = item({ pointsMax: 40, resultPoints: 30, resultMax: 40, at: '2026-11-01T09:00:00Z' })
    const p2 = item({ pointsMax: 40, at: '2026-12-01T09:00:00Z' })
    const i = item({
      kind: 'integral',
      resultPoints: 60,
      resultMax: 100,
      at: '2027-01-27T09:00:00Z',
    })
    const slots = slotsOf([p1, p2, i], 100)
    expect(slots).toHaveLength(1)
    expect(slots[0]).toMatchObject({ itemId: i.id, worth: 80, earned: 48 })
    expect(slots[0]?.coversIds).toEqual([p1.id, p2.id])
  })

  it('keeps the partials while the integral has no result', () => {
    const p1 = item({ pointsMax: 40, resultPoints: 30, resultMax: 40 })
    const p2 = item({ pointsMax: 40 })
    const i = item({ kind: 'integral', at: '2027-01-27T09:00:00Z' })
    const p = project([p1, p2, i], subject)
    expect(p.slots.map((s) => s.itemId)).toEqual([p1.id, p2.id])
    expect(p.remaining).toBe(40)
  })

  it('treats an integral without partials as an item of its own', () => {
    const f = item({ kind: 'final', pointsMax: 50 })
    const i = item({ kind: 'integral', pointsMax: 50 })
    expect(slotsOf([f, i], 100)).toHaveLength(2)
  })
})

describe('entry conditions', () => {
  it('sums counted points before the exam', () => {
    const hw = item({
      kind: 'deadline',
      pointsMax: 14,
      resultPoints: 8,
      resultMax: 14,
      at: '2026-10-23T09:00:00Z',
    })
    const final = item({
      kind: 'final',
      pointsMax: 80,
      entryMinPoints: 10,
      at: '2027-01-30T09:00:00Z',
    })
    expect(entryConditions([hw, final], 100)).toEqual([
      { itemId: final.id, required: 10, have: 8, missing: 2 },
    ])
  })
})

describe('retakeStatus', () => {
  it('waits, then is needed after a failed or waived exam, then is done', () => {
    const p = item({ pointsMax: 40, passMinPct: 50 })
    const m = item({ kind: 'makeup', retakeOf: p.id, at: '2027-02-15T09:00:00Z' })
    expect(retakeStatus(m, [p, m])).toBe('standby')
    const failed = { ...p, resultPoints: 12, resultMax: 40 }
    expect(retakeStatus(m, [failed, m])).toBe('needed')
    const passed = { ...p, resultPoints: 30, resultMax: 40 }
    expect(retakeStatus(m, [passed, m])).toBe('standby')
    expect(retakeStatus(m, [{ ...passed, annulled: true }, m])).toBe('needed')
    const done = { ...m, resultPoints: 25, resultMax: 40 }
    expect(retakeStatus(done, [failed, done])).toBe('done')
  })
})

describe('suggestPassed', () => {
  it('compares the share with the threshold', () => {
    expect(suggestPassed(0.5, 50)).toBe(true)
    expect(suggestPassed(0.49, 50)).toBe(false)
    expect(suggestPassed(0, null)).toBe(true)
  })
})

describe('properties', () => {
  const arbResult = fc.option(
    fc
      .tuple(
        fc.double({ min: 0.5, max: 200, noNaN: true }),
        fc.double({ min: 0, max: 2, noNaN: true }),
      )
      .map(([max, share]) => ({ resultMax: max, resultPoints: max * share })),
    { nil: null },
  )
  const arbItem = fc
    .record({
      kind: fc.constantFrom('partial', 'final', 'integral', 'other', 'deadline' as const),
      pointsMax: fc.option(fc.double({ min: 1, max: 100, noNaN: true }), { nil: null }),
      pointsUnit: fc.constantFrom('points' as const, 'percent' as const),
      passMinPct: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
      day: fc.integer({ min: 1, max: 28 }),
      result: arbResult,
      annulled: fc.boolean(),
      passed: fc.option(fc.boolean(), { nil: null }),
    })
    .map((r) =>
      item({
        kind: r.kind,
        pointsMax: r.pointsMax,
        pointsUnit: r.pointsUnit,
        passMinPct: r.passMinPct,
        at: `2026-11-${String(r.day).padStart(2, '0')}T09:00:00Z`,
        resultPoints: r.result?.resultPoints ?? null,
        resultMax: r.result?.resultMax ?? null,
        annulled: r.annulled,
        passed: r.passed,
      }),
    )
  // Makeups repeat one of the generated exams.
  const arbItems = fc.array(arbItem, { minLength: 1, maxLength: 8 }).chain((base) =>
    fc
      .array(
        fc.record({
          target: fc.nat({ max: base.length - 1 }),
          result: arbResult,
          day: fc.integer({ min: 1, max: 28 }),
        }),
        { maxLength: 3 },
      )
      .map((makeups) => [
        ...base,
        ...makeups.map((m) =>
          item({
            kind: 'makeup',
            retakeOf: base[m.target]!.id,
            at: `2027-02-${String(m.day).padStart(2, '0')}T09:00:00Z`,
            resultPoints: m.result?.resultPoints ?? null,
            resultMax: m.result?.resultMax ?? null,
          }),
        ),
      ]),
  )

  it('a contribution never exceeds the points the item carries', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), arbResult, (worth, result) => {
        const c = contribution(worth, result ?? { resultPoints: null, resultMax: null })
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThanOrEqual(worth + 1e-9)
      }),
    )
  })

  it('every slot earns at most its worth and have + remaining = maxPossible', () => {
    fc.assert(
      fc.property(arbItems, (items) => {
        const p = project(items, subject)
        for (const s of p.slots) expect(s.earned).toBeLessThanOrEqual(s.worth + 1e-9)
        expect(p.have).toBeLessThanOrEqual(p.maxSoFar + 1e-9)
        expect(p.have + p.remaining).toBeCloseTo(p.maxPossible)
      }),
    )
  })

  it('a higher grade never needs fewer points', () => {
    fc.assert(
      fc.property(arbItems, (items) => {
        const rank = (g: ReturnType<typeof project>['grades'][number]) =>
          g.kind === 'secured' ? 0 : g.kind === 'needs' ? g.points : Infinity
        const grades = project(items, subject).grades
        for (let i = 1; i < grades.length; i++) {
          expect(rank(grades[i]!)).toBeGreaterThanOrEqual(rank(grades[i - 1]!))
        }
      }),
    )
  })
})

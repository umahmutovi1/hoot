import { describe, expect, it } from 'vitest'
import cases from './model.cases.json'
import { DURATION_PRIORS, optimism, sourceRate, userEffect, type SourceStats } from './model'
import { givenRate } from '.'

const src = (id: string, over: Partial<SourceStats> = {}): SourceStats => ({
  id,
  kind: 'book',
  base: 4,
  learned: null,
  samples: 0,
  given: null,
  ...over,
})

describe('sourceRate', () => {
  it('without measurements the mean is the heuristic base, with a reserve above it', () => {
    const r = sourceRate(src('a'))
    expect(r.mean).toBeCloseTo(4, 10)
    expect(r.p50).toBeLessThan(r.mean)
    expect(r.p80).toBeGreaterThan(r.mean)
  })

  it('measurements pull the rate towards what was measured, more of them more strongly', () => {
    const few = sourceRate(src('a', { learned: 8, samples: 2 }))
    const many = sourceRate(src('a', { learned: 8, samples: 30 }))
    expect(few.mean).toBeGreaterThan(4)
    expect(many.mean).toBeGreaterThan(few.mean)
    expect(many.mean).toBeLessThan(8)
    expect(many.mean).toBeGreaterThan(7)
  })

  it('the reserve shrinks with measurements', () => {
    const none = sourceRate(src('a'))
    const many = sourceRate(src('a', { learned: 4, samples: 20 }))
    expect(many.p80 / many.mean).toBeLessThan(none.p80 / none.mean)
  })

  it("the user's speed on other sources of the kind moves a new source", () => {
    const slow = src('b', { learned: 8, samples: 12 })
    const fresh = sourceRate(src('a'), [slow])
    expect(fresh.mean).toBeGreaterThan(4.5)
    // Its own measurements are not counted twice.
    expect(userEffect([slow], 'book', 'b').mean).toBe(0)
    // Another kind counts only when the kind has nothing measured.
    const slides = src('s', { kind: 'slides', base: 1.5, learned: 3, samples: 12 })
    expect(sourceRate(src('a'), [slides, slow]).mean).toBeCloseTo(fresh.mean, 10)
  })

  it('a given number is the prior; the optimism seen on other sources corrects it', () => {
    expect(sourceRate(src('a', { given: 6 })).mean).toBeCloseTo(6, 10)
    const before = src('b', { given: 5, learned: 7.5, samples: 20 })
    expect(optimism([before], 'a')).toBeGreaterThan(0)
    expect(sourceRate(src('a', { given: 6 }), [before]).mean).toBeGreaterThan(6.5)
  })

  it('the priors carry a version for input_hash', () => {
    expect(DURATION_PRIORS.version).toBeGreaterThanOrEqual(1)
  })

  it('the cases shared with ml/ (TS = Python)', () => {
    for (const c of cases.cases) {
      const r = sourceRate(c.source, c.others)
      expect(r.mean).toBeCloseTo(c.expected.mean, 9)
      expect(r.p50).toBeCloseTo(c.expected.p50, 9)
      expect(r.p80).toBeCloseTo(c.expected.p80, 9)
      expect(r.unitP80).toBeCloseTo(c.expected.unitP80, 9)
    }
  })
})

describe('givenRate', () => {
  it('geometric mean of given minutes per unit of measure, at difficulty 3', () => {
    expect(
      givenRate([
        { estMinutes: 40, amount: 10, difficulty: 3 },
        { estMinutes: 90, amount: 10, difficulty: 3 },
        { estMinutes: null, amount: 10, difficulty: 3 },
      ]),
    ).toBeCloseTo(6, 10)
    expect(givenRate([{ estMinutes: 26, amount: 10, difficulty: 4 }])).toBeCloseTo(2, 10)
    expect(givenRate([{ estMinutes: null, amount: 5, difficulty: 3 }])).toBeNull()
  })
})

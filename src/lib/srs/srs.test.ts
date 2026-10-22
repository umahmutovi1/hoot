import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { addDays, diffDays } from '@/lib/day'
import {
  clampReviewOn,
  combineRecall,
  levelAfter,
  outlineRecall,
  ratingOf,
  retrievabilityOn,
  review,
  strengthBand,
  targetRetention,
  unitStrength,
  weightedStrength,
  type Memory,
  type Recall,
} from '.'

const TODAY = '2026-10-22'

function first(recall: Recall, lastDay: string | null = null) {
  return review({ memory: null, recall, today: TODAY, retention: 0.88, lastDay })
}

describe('ratingOf', () => {
  it('maps recall 0/1/2 to Again/Hard/Good', () => {
    expect([ratingOf(0), ratingOf(1), ratingOf(2)]).toEqual([1, 2, 3])
  })
})

describe('targetRetention', () => {
  it('follows the priority table', () => {
    expect([1, 2, 3, 4, 5].map((p) => targetRetention(p, 'question'))).toEqual([
      0.8, 0.8, 0.85, 0.9, 0.9,
    ])
    expect(targetRetention(3, 'card')).toBe(0.85)
  })

  it('adds 0.03 for chapters, at most 0.93', () => {
    expect(targetRetention(1, 'chapter')).toBe(0.83)
    expect(targetRetention(3, 'chapter')).toBe(0.88)
    expect(targetRetention(5, 'chapter')).toBe(0.93)
  })
})

describe('strengthBand', () => {
  it('uses the UI scale', () => {
    expect(strengthBand(0.85)).toBe('strong')
    expect(strengthBand(0.849)).toBe('strong')
    expect(strengthBand(0.84)).toBe('good')
    expect(strengthBand(0.75)).toBe('good')
    expect(strengthBand(0.74)).toBe('weak')
    expect(strengthBand(0.6)).toBe('weak')
    expect(strengthBand(0.59)).toBe('fading')
  })
})

describe('review', () => {
  it('starts a memory on the first test and schedules it after today', () => {
    const r = first(2)
    expect(r.memory.reps).toBe(1)
    expect(r.memory.lastReviewOn).toBe(TODAY)
    expect(r.memory.streak).toBe(1)
    expect(r.elapsedDays).toBe(0)
    expect(r.stabilityBefore).toBeNull()
    expect(r.retrievabilityBefore).toBeNull()
    expect(r.nextReviewOn > TODAY).toBe(true)
  })

  it('gives longer intervals to better recall', () => {
    const d = (x: Recall) => diffDays(TODAY, first(x).nextReviewOn)
    expect(d(0)).toBeLessThanOrEqual(d(1))
    expect(d(1)).toBeLessThanOrEqual(d(2))
    expect(first(2).memory.stability).toBeGreaterThan(first(0).memory.stability)
  })

  it('logs elapsed days and stability before and after', () => {
    const a = first(2)
    const later = addDays(TODAY, 5)
    const b = review({ memory: a.memory, recall: 2, today: later, retention: 0.88, lastDay: null })
    expect(b.elapsedDays).toBe(5)
    expect(b.stabilityBefore).toBe(a.memory.stability)
    expect(b.stabilityAfter).toBe(b.memory.stability)
    expect(b.retrievabilityBefore).toBeLessThan(1)
    expect(b.memory.streak).toBe(2)
    expect(b.memory.reps).toBe(2)
  })

  it('a miss resets the streak and counts a lapse once in review', () => {
    let m = first(2).memory
    let day = TODAY
    for (let i = 0; i < 2; i++) {
      day = addDays(day, 7)
      m = review({ memory: m, recall: 2, today: day, retention: 0.88, lastDay: null }).memory
    }
    const miss = review({
      memory: m,
      recall: 0,
      today: addDays(day, 7),
      retention: 0.88,
      lastDay: null,
    })
    expect(miss.memory.streak).toBe(0)
    expect(miss.memory.lapses).toBe(m.lapses + 1)
    expect(miss.memory.stability).toBeLessThan(m.stability)
  })

  it('a higher target gives shorter intervals', () => {
    const lo = review({ memory: null, recall: 2, today: TODAY, retention: 0.8, lastDay: null })
    const hi = review({ memory: null, recall: 2, today: TODAY, retention: 0.93, lastDay: null })
    expect(hi.nextReviewOn <= lo.nextReviewOn).toBe(true)
  })

  it('never schedules past the last day before the exam', () => {
    const memory: Memory = {
      stability: 60,
      difficulty: 5,
      state: 2,
      reps: 3,
      lapses: 0,
      lastReviewOn: addDays(TODAY, -10),
      streak: 3,
    }
    const r = review({ memory, recall: 2, today: TODAY, retention: 0.85, lastDay: '2026-10-26' })
    expect(r.nextReviewOn).toBe('2026-10-26')
  })

  it('is deterministic', () => {
    expect(first(1)).toEqual(first(1))
  })
})

describe('clampReviewOn', () => {
  it('keeps a review after today', () => {
    expect(clampReviewOn(TODAY, TODAY, null)).toBe('2026-10-23')
  })
  it('ignores a last day that already passed', () => {
    expect(clampReviewOn('2026-11-30', TODAY, TODAY)).toBe('2026-11-30')
  })
})

describe('retrievabilityOn', () => {
  it('is 1 on the review day and falls after it', () => {
    const m = { stability: 10, lastReviewOn: TODAY }
    expect(retrievabilityOn(m, TODAY)).toBeCloseTo(1)
    expect(retrievabilityOn(m, addDays(TODAY, 10))).toBeCloseTo(0.9, 2)
    expect(retrievabilityOn(m, addDays(TODAY, 30))).toBeLessThan(0.9)
  })
})

describe('levelAfter', () => {
  it('chapters reach "Razumijem" on success and "Ponovljeno" after 4 in a row', () => {
    expect(levelAfter('chapter', 1, 2, 1)).toBe(2)
    expect(levelAfter('chapter', 2, 2, 3)).toBe(2)
    expect(levelAfter('chapter', 2, 2, 4)).toBe(3)
    expect(levelAfter('chapter', 3, 2, 5)).toBe(3)
  })
  it('a miss sends a known chapter back to learning; a read one stays read', () => {
    expect(levelAfter('chapter', 3, 0, 0)).toBe(1)
    expect(levelAfter('chapter', 2, 0, 0)).toBe(1)
    expect(levelAfter('chapter', 1, 0, 0)).toBe(1)
    expect(levelAfter('chapter', 2, 1, 0)).toBe(2)
    expect(levelAfter('chapter', 1, 1, 0)).toBe(1)
  })
  it('questions use 0, 1 and 3', () => {
    expect(levelAfter('question', 0, 2, 1)).toBe(3)
    expect(levelAfter('question', 0, 1, 0)).toBe(1)
    expect(levelAfter('question', 3, 1, 0)).toBe(1)
    expect(levelAfter('question', 3, 0, 0)).toBe(1)
    expect(levelAfter('question', 0, 0, 0)).toBe(0)
  })
})

describe('combineRecall and outlineRecall', () => {
  it('rounds the mean of several items', () => {
    expect(combineRecall([])).toBeNull()
    expect(combineRecall([2, 2, 1])).toBe(2)
    expect(combineRecall([2, 1])).toBe(2)
    expect(combineRecall([2, 0])).toBe(1)
    expect(combineRecall([1, 0, 0])).toBe(0)
  })
  it('maps the share of explained subheadings', () => {
    expect(outlineRecall(4, 5)).toBe(2)
    expect(outlineRecall(2, 5)).toBe(1)
    expect(outlineRecall(1, 5)).toBe(0)
    expect(outlineRecall(0, 0)).toBe(0)
  })
})

describe('strength', () => {
  it('cards weigh as one more unit', () => {
    expect(unitStrength(null, [])).toBeNull()
    expect(unitStrength(0.9, [])).toBe(0.9)
    expect(unitStrength(null, [0.6, 0.8])).toBeCloseTo(0.7)
    expect(unitStrength(0.9, [0.6, 0.8])).toBeCloseTo(0.8)
  })
  it('is weighted by minutes over units in review only', () => {
    expect(weightedStrength([{ minutes: 60, strength: null }])).toBeNull()
    expect(
      weightedStrength([
        { minutes: 30, strength: 0.9 },
        { minutes: 90, strength: 0.5 },
        { minutes: 500, strength: null },
      ]),
    ).toBeCloseTo(0.6)
  })
})

describe('properties', () => {
  const memoryArb = fc.record({
    stability: fc.double({ min: 0.1, max: 400, noNaN: true }),
    difficulty: fc.double({ min: 1, max: 10, noNaN: true }),
    state: fc.constant(2),
    reps: fc.integer({ min: 1, max: 30 }),
    lapses: fc.integer({ min: 0, max: 10 }),
    lastReviewOn: fc.integer({ min: 0, max: 200 }).map((n) => addDays(TODAY, -n)),
    streak: fc.integer({ min: 0, max: 10 }),
  })

  it('strength falls with time', () => {
    fc.assert(
      fc.property(
        memoryArb,
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 1, max: 300 }),
        (m, a, b) => {
          const r1 = retrievabilityOn(m, addDays(m.lastReviewOn, a))
          const r2 = retrievabilityOn(m, addDays(m.lastReviewOn, a + b))
          return r2 <= r1 && r1 <= 1 && r2 >= 0
        },
      ),
    )
  })

  it('the next review is after today and never after the last day before the exam', () => {
    fc.assert(
      fc.property(
        fc.option(memoryArb, { nil: null }),
        fc.constantFrom<Recall>(0, 1, 2),
        fc.constantFrom(0.8, 0.83, 0.85, 0.88, 0.9, 0.93),
        fc.option(fc.integer({ min: 1, max: 120 }), { nil: null }),
        (memory, recall, retention, examIn) => {
          const lastDay = examIn === null ? null : addDays(TODAY, examIn)
          const r = review({ memory, recall, today: TODAY, retention, lastDay })
          if (r.nextReviewOn <= TODAY) return false
          if (lastDay !== null && lastDay > TODAY && r.nextReviewOn > lastDay) return false
          return r.memory.stability > 0 && r.memory.lastReviewOn === TODAY
        },
      ),
    )
  })
})

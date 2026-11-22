import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { SUMMARY_MIN_MINUTES, summaryMinutes, summaryPace } from './summary'

const none = { rate: null, samples: 0 }

describe('summaryMinutes', () => {
  it('uses 20% of reading before the summary exists, rounded to 5', () => {
    expect(summaryMinutes(55, null, none)).toBe(10)
    expect(summaryMinutes(185, null, none)).toBe(35)
  })

  it('uses the summary length at the prior pace (3 min / 100 words)', () => {
    expect(summaryMinutes(120, 400, none)).toBe(10)
    expect(summaryMinutes(120, 700, none)).toBe(20)
  })

  it('moves toward the learned pace as samples grow', () => {
    const slow = { rate: 6, samples: 5 }
    // (5/10)·6 + (5/10)·3 = 4.5 min / 100 words
    expect(summaryMinutes(120, 600, slow)).toBe(25)
  })

  it('never goes below the minimum or above reading', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 600 }),
        fc.option(fc.integer({ min: 1, max: 5000 }), { nil: null }),
        fc.option(fc.double({ min: 0.1, max: 20, noNaN: true }), { nil: null }),
        fc.integer({ min: 0, max: 30 }),
        (reading, words, rate, samples) => {
          const m = summaryMinutes(reading, words, { rate, samples })
          expect(m).toBeLessThanOrEqual(reading)
          expect(m).toBeGreaterThanOrEqual(Math.min(reading, SUMMARY_MIN_MINUTES))
        },
      ),
    )
  })
})

describe('summaryPace', () => {
  it('averages minutes per 100 words and skips empty samples', () => {
    expect(
      summaryPace([
        { minutes: 12, words: 400 },
        { minutes: 0, words: 300 },
        { minutes: 10, words: 200 },
      ]),
    ).toEqual({ rate: 4, samples: 2 })
    expect(summaryPace([])).toEqual(none)
  })
})

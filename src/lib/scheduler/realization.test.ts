import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { growthBase, growthLimit, realization, type DayHistory } from '.'

const TODAY = '2026-10-22'
const day = (n: number, over: Partial<DayHistory> = {}): DayHistory => ({
  date: addDays(TODAY, -n),
  plannedMin: 100,
  doneAiMin: 100,
  studiedMin: 100,
  skipped: false,
  ...over,
})

describe('realization', () => {
  it('is 0.8 without history', () => {
    expect(realization([], TODAY)).toEqual({ rho: 0.8, days: 0, measured: null })
  })

  it('shrinks the measured ratio towards 0.8 with weight 7 days', () => {
    const history = Array.from({ length: 7 }, (_, i) => day(i + 1, { doneAiMin: 60 }))
    // (7 · 0.6 + 7 · 0.8) / 14 = 0.7
    expect(realization(history, TODAY)).toEqual({ rho: 0.7, days: 7, measured: 0.6 })
  })

  it('ignores days without a plan, "Danas ne mogu" days, today and days older than 14', () => {
    const history = [
      day(0, { doneAiMin: 0 }),
      day(1, { plannedMin: 0, doneAiMin: 0 }),
      day(2, { skipped: true, doneAiMin: 0 }),
      day(15, { doneAiMin: 0 }),
      day(3),
    ]
    expect(realization(history, TODAY).days).toBe(1)
    expect(realization(history, TODAY).measured).toBe(1)
  })

  it('is clamped to [0.5, 1]', () => {
    const none = Array.from({ length: 14 }, (_, i) => day(i + 1, { doneAiMin: 0 }))
    expect(realization(none, TODAY).rho).toBe(0.5)
    const over = Array.from({ length: 14 }, (_, i) => day(i + 1, { doneAiMin: 300 }))
    expect(realization(over, TODAY).rho).toBeLessThanOrEqual(1)
  })
})

describe('growth limit', () => {
  it('has no limit without a planned day in the last 7 days (new user)', () => {
    expect(growthBase([day(1, { plannedMin: 0 })], TODAY)).toBeNull()
    expect(growthLimit(null, 0)).toBe(Infinity)
  })

  it('averages studied minutes over 7 days, zeros included', () => {
    expect(growthBase([day(1, { studiedMin: 140 }), day(2, { studiedMin: 70 })], TODAY)).toBe(30)
  })

  it('ramps from 1.25 × the average (at least 60), 1.25× a day', () => {
    expect(growthLimit(80, 0)).toBe(100)
    expect(growthLimit(80, 1)).toBe(125)
    expect(growthLimit(0, 0)).toBe(60)
    expect(growthLimit(0, 2)).toBe(93)
  })
})

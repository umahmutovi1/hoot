import { describe, expect, it } from 'vitest'
import { weekBars, weekDays } from './week'

describe('weekBars', () => {
  it('puts planned and done on one scale', () => {
    const bars = weekBars([
      { day: '2026-11-02', planned: 120, done: 60 },
      { day: '2026-11-03', planned: 60, done: 150 },
    ])
    // The largest value (150 done) is the full height.
    expect(bars).toEqual([
      { planned: 58, done: 29 },
      { planned: 29, done: 72 },
    ])
  })

  it('keeps a small planned day visible and an empty one flat', () => {
    const bars = weekBars([
      { day: '2026-11-02', planned: 200, done: 0 },
      { day: '2026-11-03', planned: 2, done: 0 },
      { day: '2026-11-04', planned: 0, done: 0 },
    ])
    expect(bars.map((b) => b.planned)).toEqual([72, 6, 0])
  })

  it('an empty week has no bars', () => {
    expect(weekBars([{ day: '2026-11-02', planned: 0, done: 0 }])).toEqual([
      { planned: 0, done: 0 },
    ])
  })
})

describe('weekDays', () => {
  it('seven days from the start with their minutes', () => {
    const days = weekDays(
      '2026-11-02',
      new Map([['2026-11-04', 90]]),
      new Map([['2026-11-08', 30]]),
    )
    expect(days).toHaveLength(7)
    expect(days[2]).toEqual({ day: '2026-11-04', planned: 90, done: 0 })
    expect(days[6]).toEqual({ day: '2026-11-08', planned: 0, done: 30 })
  })
})

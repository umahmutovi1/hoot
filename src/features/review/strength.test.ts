import { describe, expect, it } from 'vitest'
import { NO_MEMORY } from '@/features/sources/model'
import { card, unit } from './fixtures'
import { memoryColumns } from './memory'
import { strengthOf, strengthSummary } from './strength'

const boundary = { timeZone: 'Europe/Sarajevo', dayStartMin: 240 }
const TODAY = '2026-10-22'
const mem = (stability: number, lastReviewOn: string) =>
  memoryColumns(
    { stability, difficulty: 5, state: 2, reps: 2, lapses: 0, lastReviewOn, streak: 1 },
    `${lastReviewOn}T10:00:00Z`,
  )

describe('strengthOf', () => {
  it('is null before the first test and includes the cards', () => {
    expect(strengthOf(unit('a'), [], TODAY, boundary)).toBeNull()
    const u = unit('a', mem(10, '2026-10-12'))
    const r = strengthOf(u, [], TODAY, boundary)!
    expect(r).toBeCloseTo(0.9, 2)
    const c = { ...card('c', 'a'), ...mem(1, '2026-10-12') }
    expect(strengthOf(u, [c], TODAY, boundary)!).toBeLessThan(r)
    expect(strengthOf(u, [{ ...card('n', 'a'), ...NO_MEMORY }], TODAY, boundary)).toBe(r)
  })
})

describe('strengthSummary', () => {
  it('weights by minutes over units in review and lists what needs a check', () => {
    const strong = unit('s', { level: 2, ...mem(100, '2026-10-20') })
    const weak = unit('w', { level: 2, ...mem(0.1, '2026-10-10') })
    const due = unit('d', { level: 1, next_review_on: TODAY })
    const fresh = unit('f', { level: 0 })
    const out = strengthSummary(
      [
        { unit: strong, minutes: 30 },
        { unit: weak, minutes: 90 },
        { unit: due, minutes: 60 },
        { unit: fresh, minutes: 60 },
      ],
      [],
      TODAY,
      boundary,
    )
    expect(out.units.map((u) => [u.unit.id, u.band])).toEqual([
      ['s', 'strong'],
      ['w', 'fading'],
    ])
    const avg = (out.units[0]!.strength * 30 + out.units[1]!.strength * 90) / 120
    expect(out.average).toBeCloseTo(avg)
    expect(out.needCheck.map((u) => u.unit.id)).toEqual(['w', 'd'])
  })
})

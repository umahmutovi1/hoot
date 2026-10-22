import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  awakeSlot,
  DEFAULT_RHYTHM,
  isDefaultTemplate,
  proposeRules,
  suggestDayStart,
  type Rhythm,
} from './rhythm'

describe('suggestDayStart', () => {
  it('is 04:00 for a usual bedtime', () => {
    expect(suggestDayStart([23 * 60 + 30, 30])).toBe(240)
  })

  it('is 2 h after a late bedtime', () => {
    expect(suggestDayStart([23 * 60, 3 * 60])).toBe(5 * 60)
  })

  it('never goes past 08:00', () => {
    expect(suggestDayStart([7 * 60])).toBe(8 * 60)
  })
})

describe('awakeSlot', () => {
  it('runs from wake-up to bedtime, until midnight when bedtime is after it', () => {
    expect(awakeSlot(DEFAULT_RHYTHM, 0)).toEqual({ startMin: 420, endMin: 1410 })
    expect(awakeSlot(DEFAULT_RHYTHM, 6)).toEqual({ startMin: 540, endMin: 1440 })
  })
})

describe('proposeRules', () => {
  it('without chosen parts proposes the whole awake time every day', () => {
    const rules = proposeRules(DEFAULT_RHYTHM, [])
    expect(rules).toHaveLength(7)
    expect(rules[0]).toEqual({ weekday: 0, startMin: 420, endMin: 1410 })
  })

  it('keeps only the chosen parts and joins neighbouring ones', () => {
    const rules = proposeRules(DEFAULT_RHYTHM, ['afternoon', 'evening']).filter(
      (r) => r.weekday === 0,
    )
    expect(rules).toEqual([{ weekday: 0, startMin: 900, endMin: 1380 }])
    const split = proposeRules(DEFAULT_RHYTHM, ['morning', 'evening']).filter(
      (r) => r.weekday === 2,
    )
    expect(split).toEqual([
      { weekday: 2, startMin: 420, endMin: 720 },
      { weekday: 2, startMin: 1140, endMin: 1380 },
    ])
  })

  it('leaves out days that are off', () => {
    const rules = proposeRules(DEFAULT_RHYTHM, ['evening'], new Set([5, 6]))
    expect(new Set(rules.map((r) => r.weekday))).toEqual(new Set([0, 1, 2, 3, 4]))
  })

  it('never proposes time outside the awake window', () => {
    const minute = fc.integer({ min: 0, max: 1439 })
    fc.assert(
      fc.property(
        minute,
        minute,
        minute,
        minute,
        fc.subarray(['morning', 'midday', 'afternoon', 'evening', 'night'] as const),
        (w1, w2, s1, s2, parts) => {
          const rhythm: Rhythm = { wake: [w1, w2], sleep: [s1, s2] }
          for (const r of proposeRules(rhythm, parts)) {
            const awake = awakeSlot(rhythm, r.weekday)
            expect(r.startMin).toBeGreaterThanOrEqual(awake.startMin)
            expect(r.endMin).toBeLessThanOrEqual(awake.endMin)
            expect(r.endMin).toBeGreaterThan(r.startMin)
          }
        },
      ),
    )
  })
})

describe('isDefaultTemplate', () => {
  it('recognises the 06–24 safety net and nothing else', () => {
    const def = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      startMin: 360,
      endMin: 1440,
    }))
    expect(isDefaultTemplate(def)).toBe(true)
    expect(isDefaultTemplate(def.slice(1))).toBe(false)
    expect(isDefaultTemplate(proposeRules(DEFAULT_RHYTHM, ['evening']))).toBe(false)
  })
})

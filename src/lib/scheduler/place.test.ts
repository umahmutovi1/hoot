import { describe, expect, it } from 'vitest'
import { BUILT_IN_PRESETS } from '@/lib/session/timer'
import { maxStudyIn, placeTimes, spanOf, type PlaceDayInput } from '.'

const standard = BUILT_IN_PRESETS[0]!
const pomodoro = BUILT_IN_PRESETS[1]!
const input = (over: Partial<PlaceDayInput> = {}): PlaceDayInput => ({
  slots: [{ startMin: 540, endMin: 720 }],
  preset: standard,
  minBlockMinutes: 25,
  preferredParts: [],
  ...over,
})

describe('placeTimes', () => {
  it('spans include the breaks inside a block', () => {
    expect(spanOf(standard, 100)).toBe(115)
    expect(spanOf(pomodoro, 100)).toBe(100 + 5 + 5 + 5)
    expect(maxStudyIn(standard, 115)).toBe(100)
    expect(maxStudyIn(standard, 60)).toBe(50)
  })

  it('places blocks one after another with the break between them', () => {
    const r = placeTimes(
      [
        { key: 'a', minutes: 50, kind: 'learn', demand: 1 },
        { key: 'b', minutes: 50, kind: 'learn', demand: 0.5 },
      ],
      input(),
    )
    expect(r.placements.map((p) => [p.key, p.startMin])).toEqual([
      ['a', 540],
      ['b', 605],
    ])
  })

  it('splits a block that fits no slot into whole intervals', () => {
    const r = placeTimes(
      [{ key: 'a', minutes: 100, kind: 'learn', demand: 1 }],
      input({
        slots: [
          { startMin: 540, endMin: 600 },
          { startMin: 700, endMin: 760 },
        ],
      }),
    )
    expect(r.placements.map((p) => [p.startMin, p.minutes])).toEqual([
      [540, 50],
      [700, 50],
    ])
    expect(r.unplaced.size).toBe(0)
  })

  it('returns what fits nowhere', () => {
    const r = placeTimes(
      [{ key: 'a', minutes: 200, kind: 'learn', demand: 1 }],
      input({ slots: [{ startMin: 540, endMin: 600 }] }),
    )
    expect(r.unplaced.get('a')).toBe(150)
  })

  it('keeps manual blocks with a time where they are', () => {
    const r = placeTimes(
      [
        { key: 'm', minutes: 50, kind: 'learn', demand: 1, fixedStart: 540, manual: true },
        { key: 'a', minutes: 50, kind: 'learn', demand: 1 },
      ],
      input(),
    )
    expect(r.placements.find((p) => p.key === 'm')!.startMin).toBe(540)
    expect(r.placements.find((p) => p.key === 'a')!.startMin).toBe(605)
  })

  it('puts learning into short slots never, reviews yes', () => {
    const r = placeTimes(
      [
        { key: 'l', minutes: 20, kind: 'learn', demand: 1 },
        { key: 'r', minutes: 10, kind: 'review', demand: 0 },
      ],
      input({ slots: [{ startMin: 540, endMin: 560 }] }),
    )
    expect(r.placements.map((p) => p.key)).toEqual(['r'])
    expect(r.unplaced.get('l')).toBe(20)
  })

  it('respects now and the exam-eve end', () => {
    const r = placeTimes(
      [{ key: 'a', minutes: 50, kind: 'learn', demand: 1 }],
      input({ slots: [{ startMin: 1200, endMin: 1440 }], notBefore: 1250, endBy: 1380 }),
    )
    expect(r.placements[0]!.startMin).toBe(1250)
    expect(
      placeTimes(
        [{ key: 'a', minutes: 50, kind: 'learn', demand: 1 }],
        input({ slots: [{ startMin: 1350, endMin: 1440 }], endBy: 1380 }),
      ).unplaced.get('a'),
    ).toBe(20)
  })

  it('gives harder work the preferred part of the day, reviews take what is left', () => {
    const r = placeTimes(
      [
        { key: 'r', minutes: 15, kind: 'review', demand: 0 },
        { key: 'l', minutes: 50, kind: 'learn', demand: 1.3 },
      ],
      input({ slots: [{ startMin: 480, endMin: 1320 }], preferredParts: ['evening'] }),
    )
    expect(r.placements.find((p) => p.key === 'l')!.startMin).toBe(19 * 60)
    expect(r.placements.find((p) => p.key === 'r')!.startMin).toBe(480)
  })
})

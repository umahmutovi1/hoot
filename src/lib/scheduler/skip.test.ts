import { describe, expect, it } from 'vitest'
import { resolvePreset } from '@/lib/session/timer'
import { skipBlock } from './skip'

const standard = resolvePreset('standard')
const h = (hour: number, min = 0) => hour * 60 + min
const signali = { id: 's', startMin: h(19), minutes: 50 }
const baze = { id: 'b', startMin: h(20, 5), minutes: 50 }
const recap = { id: 'r', startMin: h(21, 10), minutes: 15 }

describe('skipBlock', () => {
  it('starts the next block now, pulls the day earlier and fits the skipped block after it', () => {
    const r = skipBlock(signali, [baze, recap], [{ startMin: h(19), endMin: h(23) }], {
      nowMin: h(19, 28),
      preset: standard,
      startNext: true,
    })
    expect(r.moved).toEqual(
      new Map([
        ['b', h(19, 28)],
        ['r', h(20, 33)],
      ]),
    )
    // After the recap (20:33–20:48) and its 15 min break.
    expect(r.skippedAt).toBe(h(21, 3))
  })

  it('without starting the next block nothing else moves; a gap between two blocks is used', () => {
    const r = skipBlock(
      signali,
      [{ id: 'b', startMin: h(21, 30), minutes: 50 }],
      [{ startMin: h(19), endMin: h(23) }],
      { nowMin: h(19, 28), preset: standard, startNext: false },
    )
    expect(r.moved.size).toBe(0)
    expect(r.skippedAt).toBe(h(19, 28))
  })

  it('is null when nothing holds the skipped block today', () => {
    const r = skipBlock(signali, [baze], [{ startMin: h(19), endMin: h(21) }], {
      nowMin: h(19, 28),
      preset: standard,
      startNext: true,
    })
    expect(r.skippedAt).toBeNull()
  })

  it('never puts the skipped block over a class (outside the free slots)', () => {
    const free = [
      { startMin: h(19), endMin: h(20) },
      { startMin: h(21, 30), endMin: h(22, 40) },
    ]
    const r = skipBlock(signali, [], free, {
      nowMin: h(19, 28),
      preset: standard,
      startNext: false,
    })
    expect(r.skippedAt).toBe(h(21, 30))
  })

  it('respects the end of the day before an exam', () => {
    const r = skipBlock(signali, [], [{ startMin: h(19), endMin: h(23) }], {
      nowMin: h(19, 28),
      preset: standard,
      startNext: false,
      endBy: h(20),
    })
    expect(r.skippedAt).toBeNull()
  })
})

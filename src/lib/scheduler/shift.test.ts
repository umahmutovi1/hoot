import { describe, expect, it } from 'vitest'
import { resolvePreset } from '@/lib/session/timer'
import { shiftRestOfDay } from './shift'

const standard = resolvePreset('standard')
const h = (hour: number, min = 0) => hour * 60 + min
const day = [{ startMin: h(9), endMin: h(21) }]

describe('shiftRestOfDay', () => {
  it('moves later blocks by the delay, keeping the break after each block', () => {
    const r = shiftRestOfDay(
      { minutes: 50 },
      [
        { id: 'b', startMin: h(11, 5), minutes: 50 },
        { id: 'c', startMin: h(12, 10), minutes: 50 },
      ],
      day,
      { nowMin: h(10, 30), preset: standard },
    )
    expect(r.moved).toEqual(
      new Map([
        ['b', h(11, 35)],
        ['c', h(12, 40)],
      ]),
    )
    expect(r.overflow).toEqual([])
  })

  it('never moves a block earlier and leaves blocks that are late enough alone', () => {
    const r = shiftRestOfDay({ minutes: 50 }, [{ id: 'b', startMin: h(15), minutes: 50 }], day, {
      nowMin: h(10, 30),
      preset: standard,
    })
    expect(r.moved.size).toBe(0)
  })

  it('jumps over classes and busy time to the next free slot', () => {
    const free = [
      { startMin: h(9), endMin: h(12) },
      { startMin: h(14), endMin: h(18) },
    ]
    const r = shiftRestOfDay({ minutes: 50 }, [{ id: 'b', startMin: h(11), minutes: 50 }], free, {
      nowMin: h(10, 30),
      preset: standard,
    })
    expect(r.moved.get('b')).toBe(h(14))
  })

  it('what does not fit today is overflow, the rest still moves', () => {
    const free = [{ startMin: h(9), endMin: h(12) }]
    const r = shiftRestOfDay(
      { minutes: 50 },
      [
        { id: 'b', startMin: h(11, 5), minutes: 50 },
        { id: 'c', startMin: h(11, 10), minutes: 15 },
      ],
      free,
      { nowMin: h(10, 30), preset: standard },
    )
    expect(r.overflow).toEqual(['b'])
    expect(r.moved.get('c')).toBe(h(11, 35))
    expect(r.moved.has('b')).toBe(false)
  })

  it('respects the end of the day before an exam', () => {
    const r = shiftRestOfDay({ minutes: 50 }, [{ id: 'b', startMin: h(19), minutes: 50 }], day, {
      nowMin: h(19),
      preset: standard,
      endBy: h(20),
    })
    expect(r.overflow).toEqual(['b'])
  })
})

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { allocateMinutes, type AllocationUnit } from './allocate'

const unit = (
  id: string,
  position: number,
  amountDone: number,
  weight = amountDone,
  sourceId = 's',
): AllocationUnit => ({
  id,
  sourceId,
  position,
  amountDone,
  weight,
})

const minutes = (entries: [string | null, number][]) => new Map(entries)

describe('allocateMinutes', () => {
  it('gives each unit its own segments when every unit has one', () => {
    const out = allocateMinutes(
      minutes([
        ['a', 30],
        ['b', 20],
      ]),
      [unit('a', 1, 10), unit('b', 2, 10)],
    )
    expect(out.minutes.get('a')).toBe(30)
    expect(out.minutes.get('b')).toBe(20)
  })

  it('spreads one tapped unit over the units read after it, by weight', () => {
    // tapped 5.1 once, read through 5.3
    const out = allocateMinutes(minutes([['a', 60]]), [
      unit('a', 1, 10, 20),
      unit('b', 2, 10, 20),
      unit('c', 3, 5, 20),
    ])
    expect(out.minutes.get('a')).toBeCloseTo(20)
    expect(out.minutes.get('b')).toBeCloseTo(20)
    expect(out.minutes.get('c')).toBeCloseTo(20)
  })

  it('stops a group at the next unit with its own segment', () => {
    const out = allocateMinutes(
      minutes([
        ['a', 10],
        ['b', 40],
      ]),
      [unit('a', 1, 10), unit('b', 2, 10), unit('c', 3, 10)],
    )
    expect(out.minutes.get('a')).toBe(10)
    expect(out.minutes.get('b')).toBe(20)
    expect(out.minutes.get('c')).toBe(20)
  })

  it('keeps time on a touched unit that was not advanced', () => {
    const out = allocateMinutes(minutes([['a', 15]]), [unit('a', 1, 0)])
    expect(out.minutes.get('a')).toBe(15)
  })

  it('spreads time without a unit over covered units no segment reaches', () => {
    const out = allocateMinutes(
      minutes([
        [null, 12],
        ['b', 10],
      ]),
      [unit('a', 1, 6), unit('b', 2, 10)],
    )
    expect(out.minutes.get('a')).toBe(12)
    expect(out.minutes.get('b')).toBe(10)
  })

  it('leaves time unassigned when nothing was covered', () => {
    expect(allocateMinutes(minutes([[null, 12]]), []).unassigned).toBe(12)
  })

  it('does not let one source reach into another', () => {
    const out = allocateMinutes(minutes([['a', 30]]), [
      unit('a', 1, 10, 10, 's1'),
      unit('x', 2, 10, 10, 's2'),
    ])
    expect(out.minutes.get('a')).toBe(30)
    expect(out.minutes.has('x')).toBe(false)
  })

  it('never loses or invents minutes (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amount: fc.integer({ min: 0, max: 20 }),
            weight: fc.integer({ min: 0, max: 50 }),
          }),
          {
            minLength: 1,
            maxLength: 6,
          },
        ),
        fc.array(
          fc.tuple(fc.option(fc.integer({ min: 0, max: 5 })), fc.integer({ min: 1, max: 90 })),
          {
            maxLength: 6,
          },
        ),
        (spec, segs) => {
          const units = spec.map((s, i) => unit(`u${i}`, i, s.amount, s.weight))
          const m = new Map<string | null, number>()
          for (const [i, min] of segs) {
            const key = i === null || i >= units.length ? null : `u${i}`
            m.set(key, (m.get(key) ?? 0) + min)
          }
          const out = allocateMinutes(m, units)
          const total = [...m.values()].reduce((s, x) => s + x, 0)
          const given = [...out.minutes.values()].reduce((s, x) => s + x, 0) + out.unassigned
          expect(given).toBeCloseTo(total, 6)
          for (const v of out.minutes.values()) expect(v).toBeGreaterThanOrEqual(0)
        },
      ),
    )
  })
})

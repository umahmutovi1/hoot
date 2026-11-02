import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { addDays, zonedInstant, type LocalDate } from '@/lib/day'
import { SLOT_PARTS, type SlotPart } from '@/lib/schedule/rhythm'
import {
  SIGNAL_STEP,
  slotObservations,
  slotSignals,
  withSignals,
  type SlotObservation,
} from './signals'

const TODAY = '2026-11-02' // a Monday
const TZ = 'Europe/Sarajevo'

const obs = (patch: Partial<SlotObservation> = {}): SlotObservation => ({
  onDate: addDays(TODAY, -1 - 7),
  part: 'morning',
  weekend: false,
  focus: 2,
  hard: false,
  speed: 1,
  startDelayMin: 0,
  minutes: 50,
  leaves: 0,
  ...patch,
})
const many = (n: number, patch: Partial<SlotObservation>) =>
  Array.from({ length: n }, (_, i) => obs({ onDate: addDays(TODAY, -1 - i), ...patch }))

const flat = (value: number) =>
  Object.fromEntries(SLOT_PARTS.map((p) => [p, value])) as Record<SlotPart, number>

describe('slotSignals', () => {
  it('a slot with better focus scores above the user’s average, a worse one below', () => {
    const s = slotSignals(
      [...many(8, { part: 'evening', focus: 3 }), ...many(8, { part: 'morning', focus: 1 })],
      TODAY,
    )
    expect(s.weekday.evening.z).toBeGreaterThan(0)
    expect(s.weekday.morning.z).toBeLessThan(0)
    expect(s.weekday.evening.focus).toBe(3)
    expect(s.weekday.evening.sessions).toBe(8)
    // No sessions: like the average.
    expect(s.weekday.night.z).toBe(0)
    expect(s.weekend.evening.z).toBe(0)
  })

  it('few measurements are shrunk towards the average (k/(k+6))', () => {
    const base = many(10, { part: 'midday', focus: 2 })
    const one = slotSignals([...base, ...many(1, { part: 'evening', focus: 3 })], TODAY)
    const twelve = slotSignals([...base, ...many(12, { part: 'evening', focus: 3 })], TODAY)
    expect(one.weekday.evening.z).toBeGreaterThan(0)
    expect(one.weekday.evening.z).toBeLessThan(twelve.weekday.evening.z)
  })

  it('old sessions weigh less (half-life 6 weeks)', () => {
    const s = slotSignals(
      [
        ...many(6, { part: 'evening', focus: 1, onDate: addDays(TODAY, -120) }),
        ...many(6, { part: 'evening', focus: 3 }),
        ...many(6, { part: 'morning', focus: 2 }),
      ],
      TODAY,
    )
    expect(s.weekday.evening.focus!).toBeGreaterThan(2.5)
    expect(s.weekday.evening.z).toBeGreaterThan(0)
  })

  it('“teško gradivo” halves the weight of a low focus', () => {
    const s = slotSignals(
      [obs({ part: 'evening', focus: 1, hard: true }), obs({ part: 'evening', focus: 3 })],
      TODAY,
    )
    // (0.5·1 + 1·3) / 1.5
    expect(s.weekday.evening.focus).toBeCloseTo(2.333, 3)
  })

  it('slow, late and distracted slots score lower', () => {
    const good = many(8, { part: 'afternoon' })
    for (const bad of [
      { speed: 1.6 },
      { startDelayMin: 45 },
      { leaves: 6 },
    ] as Partial<SlotObservation>[]) {
      const s = slotSignals([...good, ...many(8, { part: 'evening', ...bad })], TODAY)
      expect(s.weekday.evening.z).toBeLessThan(0)
      expect(s.weekday.afternoon.z).toBeGreaterThan(0)
    }
    const late = slotSignals(many(4, { part: 'evening', startDelayMin: 45 }), TODAY)
    expect(late.weekday.evening.lateShare).toBe(1)
    expect(
      slotSignals(many(2, { leaves: 3, minutes: 30 }), TODAY).weekday.morning.leavesPer30,
    ).toBe(3)
  })

  it('property: the combined z stays bounded and order of sessions does not matter', () => {
    const arb = fc.array(
      fc.record({
        part: fc.constantFrom(...SLOT_PARTS),
        weekend: fc.boolean(),
        focus: fc.option(fc.integer({ min: 1, max: 3 }), { nil: null }),
        hard: fc.boolean(),
        speed: fc.option(fc.double({ min: 0.2, max: 5, noNaN: true }), { nil: null }),
        startDelayMin: fc.option(fc.integer({ min: -10, max: 240 }), { nil: null }),
        minutes: fc.integer({ min: 1, max: 180 }),
        leaves: fc.integer({ min: 0, max: 20 }),
        age: fc.integer({ min: 0, max: 200 }),
      }),
      { maxLength: 40 },
    )
    fc.assert(
      fc.property(arb, (rows) => {
        const list = rows.map(({ age, ...r }) => obs({ ...r, onDate: addDays(TODAY, -age) }))
        const a = slotSignals(list, TODAY)
        const b = slotSignals([...list].reverse(), TODAY)
        for (const kind of ['weekday', 'weekend'] as const)
          for (const part of SLOT_PARTS) {
            // Values in [-1, 1] over a spread ≥ 0.25 give at most 8 sd per signal.
            expect(Math.abs(a[kind][part].z)).toBeLessThanOrEqual(8)
            expect(a[kind][part].z).toBeCloseTo(b[kind][part].z, 2)
          }
      }),
      { numRuns: 200 },
    )
  })
})

describe('withSignals', () => {
  it('one sd of the combined signal moves a score by one slot gap, within [0, 1]', () => {
    const signals = slotSignals(
      [...many(12, { part: 'evening', focus: 3 }), ...many(12, { part: 'morning', focus: 1 })],
      TODAY,
    )
    const scores = withSignals({ weekday: flat(0.7), weekend: flat(0.7) }, signals)
    expect(scores.weekday.evening).toBeCloseTo(0.7 + SIGNAL_STEP * signals.weekday.evening.z, 3)
    expect(scores.weekday.morning).toBeLessThan(0.7)
    expect(scores.weekend.evening).toBe(0.7)
    const top = withSignals({ weekday: flat(0.99), weekend: flat(0) }, signals)
    expect(top.weekday.evening).toBeLessThanOrEqual(1)
  })

  it('without sessions the scores stay as they are', () => {
    const scores = { weekday: flat(0.6), weekend: flat(0.5) }
    expect(withSignals(scores, slotSignals([], TODAY))).toEqual(scores)
  })
})

describe('slotObservations', () => {
  const at = (date: LocalDate, minutes: number) => zonedInstant(date, minutes, TZ).toISOString()

  it('part, weekend, speed against the estimate and delay from the planned start', () => {
    const [o] = slotObservations(
      [
        {
          startedAt: at('2026-10-31', 20 * 60 + 40), // Saturday 20:40
          blockId: 'b',
          minutes: 45,
          focus: 2,
          focusReasons: ['hard', 'phone'],
          distractions: 1,
          appLeaves: 2,
          units: [
            { unitId: 'u1', minutes: 30, amountDone: 2 },
            { unitId: 'gone', minutes: 15, amountDone: 1 },
          ],
        },
      ],
      new Map([['b', at('2026-10-31', 20 * 60)]]),
      new Map([['u1', 10]]),
      { timeZone: TZ, dayStartMin: 240 },
    )
    expect(o).toMatchObject({
      onDate: '2026-10-31',
      part: 'evening',
      weekend: true,
      hard: true,
      speed: 1.5,
      startDelayMin: 40,
      leaves: 3,
    })
  })

  it('after midnight the session belongs to the previous day, at night', () => {
    const [o] = slotObservations(
      [
        {
          startedAt: at('2026-11-03', 60),
          blockId: null,
          minutes: 30,
          focus: null,
          focusReasons: null,
          distractions: 0,
          appLeaves: 0,
          units: [],
        },
      ],
      new Map(),
      new Map(),
      { timeZone: TZ, dayStartMin: 240 },
    )
    expect(o).toMatchObject({
      onDate: '2026-11-02',
      part: 'night',
      speed: null,
      startDelayMin: null,
    })
  })
})

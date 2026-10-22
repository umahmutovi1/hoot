import { describe, expect, it } from 'vitest'
import {
  activeMs,
  closeAt,
  forgottenSegment,
  breakAfterBlock,
  breakEndsAt,
  breaksWithin,
  customPreset,
  flowBreakMin,
  planIntervalMin,
  presetReminder,
  resolvePreset,
  MINUTE,
  msByUnit,
  pauseStats,
  suggestedEnd,
  timerStatus,
  type Segment,
} from './timer'

const T0 = new Date('2026-10-21T08:00:00Z').getTime()
const at = (min: number) => new Date(T0 + min * MINUTE)
const seg = (
  id: string,
  from: number,
  to: number | null,
  unitId: string | null = 'u1',
): Segment => ({
  id,
  unitId,
  startedAt: at(from),
  endedAt: to === null ? null : at(to),
})

describe('activeMs', () => {
  it('sums closed segments and the open one until now', () => {
    const segments = [seg('a', 0, 20), seg('b', 25, null)]
    expect(activeMs(segments, at(40))).toBe(35 * MINUTE)
  })

  it('is the same whenever it is read (no ticks)', () => {
    const segments = [seg('a', 0, null)]
    // A phone locked for an hour: the next read is just now − start.
    expect(activeMs(segments, at(60))).toBe(60 * MINUTE)
  })
})

describe('timerStatus', () => {
  it('runs while a segment is open, paused otherwise', () => {
    expect(timerStatus([seg('a', 0, null)])).toBe('running')
    expect(timerStatus([seg('a', 0, 10)])).toBe('paused')
  })
})

describe('msByUnit', () => {
  it('groups time per unit, null = no unit', () => {
    const m = msByUnit(
      [
        seg('a', 0, 10, 'u1'),
        seg('b', 10, 15, 'u2'),
        seg('c', 20, 30, 'u1'),
        seg('d', 30, 32, null),
      ],
      at(40),
    )
    expect(m.get('u1')).toBe(20 * MINUTE)
    expect(m.get('u2')).toBe(5 * MINUTE)
    expect(m.get(null)).toBe(2 * MINUTE)
  })
})

describe('pauseStats', () => {
  it('counts gaps, not unit switches', () => {
    // switch at 10 (no gap), pause 15→20
    const segments = [seg('a', 0, 10), seg('b', 10, 15, 'u2'), seg('c', 20, 30)]
    expect(pauseStats(segments, at(30), at(30))).toEqual({ count: 1, ms: 5 * MINUTE })
  })

  it('counts a pause that is still going', () => {
    expect(pauseStats([seg('a', 0, 10)], at(14))).toEqual({ count: 1, ms: 4 * MINUTE })
  })

  it('is empty without segments', () => {
    expect(pauseStats([], at(0))).toEqual({ count: 0, ms: 0 })
  })
})

const standard = resolvePreset('standard')
const pomodoro = resolvePreset('pomodoro')
const flow = resolvePreset('flow')
const free = resolvePreset('free')
const own = customPreset({
  id: 'custom:00000000-0000-4000-8000-000000000001',
  name: 'Moj niz',
  steps: [
    { kind: 'work', min: 45 },
    { kind: 'break', min: 10 },
    { kind: 'work', min: 45 },
    { kind: 'break', min: 20 },
  ],
  long_break: null,
})

describe('resolvePreset', () => {
  it('knows built-ins, the Stage 7 modes and custom presets', () => {
    expect(standard).toMatchObject({ kind: 'cycle', id: 'standard' })
    expect(resolvePreset('pomodoro50')).toMatchObject({ kind: 'cycle', id: 'pomodoro50' })
    expect(resolvePreset(own.id, [{ id: own.id, name: 'x', steps: [], long_break: null }]).id).toBe(
      own.id,
    )
  })

  it('falls back to Standardno for an unknown or deleted preset', () => {
    expect(resolvePreset('custom:gone').id).toBe('standard')
    expect(resolvePreset(null).id).toBe('standard')
  })
})

describe('presetReminder', () => {
  it('is off in free mode', () => {
    expect(presetReminder(free, [seg('a', 0, null)], at(5))).toBeNull()
  })

  it('counts work from the start of the stretch, across unit switches', () => {
    const segments = [seg('a', 0, 10), seg('b', 10, null, 'u2')]
    const r = presetReminder(pomodoro, segments, at(23))!
    expect(r.phase).toBe('work')
    expect(r.remainingMs).toBe(2 * MINUTE)
  })

  it('restarts work after a pause', () => {
    const segments = [seg('a', 0, 25), seg('b', 30, null)]
    expect(presetReminder(pomodoro, segments, at(40))!.remainingMs).toBe(15 * MINUTE)
  })

  it('goes negative when the break is due, but never pauses by itself', () => {
    const segments = [seg('a', 0, null)]
    const r = presetReminder(standard, segments, at(55))!
    expect(r.remainingMs).toBe(-5 * MINUTE)
    expect(timerStatus(segments)).toBe('running')
  })

  it('counts the break from the last segment end', () => {
    const r = presetReminder(standard, [seg('a', 0, 50)], at(52))!
    expect(r).toEqual({ phase: 'break', totalMs: 15 * MINUTE, remainingMs: 13 * MINUTE })
  })

  it('gives Pomodoro a long break after every 4th interval', () => {
    const four = [seg('a', 0, 25), seg('b', 30, 55), seg('c', 60, 85), seg('d', 90, 115)]
    const r = presetReminder(pomodoro, four, at(115))!
    expect(r).toMatchObject({ phase: 'break', totalMs: 20 * MINUTE, long: true })
    expect(presetReminder(pomodoro, four.slice(0, 3), at(85))!.totalMs).toBe(5 * MINUTE)
  })

  it('walks a custom sequence step by step and repeats it', () => {
    expect(presetReminder(own, [seg('a', 0, 45)], at(45))!.totalMs).toBe(10 * MINUTE)
    expect(presetReminder(own, [seg('a', 0, 45), seg('b', 55, 100)], at(100))!.totalMs).toBe(
      20 * MINUTE,
    )
    const third = [seg('a', 0, 45), seg('b', 55, 100), seg('c', 120, null)]
    expect(presetReminder(own, third, at(120))!.totalMs).toBe(45 * MINUTE)
  })

  it('Flowtime has no study countdown and a break of a fifth of the stretch', () => {
    expect(presetReminder(flow, [seg('a', 0, null)], at(70))).toBeNull()
    expect(presetReminder(flow, [seg('a', 0, 60)], at(60))!.totalMs).toBe(12 * MINUTE)
  })
})

describe('flowBreakMin', () => {
  it('is study / 5, between 5 and 20 min', () => {
    expect(flowBreakMin(10 * MINUTE)).toBe(5)
    expect(flowBreakMin(40 * MINUTE)).toBe(8)
    expect(flowBreakMin(200 * MINUTE)).toBe(20)
  })
})

describe('breakEndsAt', () => {
  it('is now + the break that starts with the pause', () => {
    expect(breakEndsAt(standard, [seg('a', 0, 50)], at(50))).toEqual(at(65))
  })

  it('is null for free sessions', () => {
    expect(breakEndsAt(free, [seg('a', 0, 50)], at(50))).toBeNull()
  })
})

describe('plan helpers', () => {
  it('aligns blocks to the first study interval, 50 min without one', () => {
    expect(planIntervalMin(standard)).toBe(50)
    expect(planIntervalMin(pomodoro)).toBe(25)
    expect(planIntervalMin(flow)).toBe(50)
  })

  it('reserves breaks between intervals inside a block', () => {
    expect(breaksWithin(standard, 50)).toEqual([])
    expect(breaksWithin(standard, 100)).toEqual([15])
    expect(breaksWithin(pomodoro, 125)).toEqual([5, 5, 5, 20])
    expect(breaksWithin(own, 135)).toEqual([10, 20])
    expect(breaksWithin(free, 300)).toEqual([])
  })

  it('leaves the next break after a block', () => {
    expect(breakAfterBlock(standard, 100)).toBe(15)
    expect(breakAfterBlock(pomodoro, 100)).toBe(20)
    expect(breakAfterBlock(free, 100)).toBe(0)
    expect(breakAfterBlock(flow, 50)).toBe(10)
  })
})

describe('forgotten timer', () => {
  it('asks after more than 3 h of one running segment', () => {
    const segments = [seg('a', 0, null)]
    expect(forgottenSegment(segments, at(180))).toBeNull()
    expect(forgottenSegment(segments, at(181))?.id).toBe('a')
  })

  it('never asks while paused', () => {
    expect(forgottenSegment([seg('a', 0, 10)], at(600))).toBeNull()
  })

  it('suggests start + 25 min, never after now', () => {
    expect(suggestedEnd(seg('a', 0, null), at(300))).toEqual(at(25))
    expect(suggestedEnd(seg('a', 0, null), at(10))).toEqual(at(10))
  })
})

describe('closeAt', () => {
  it('cuts the open segment and drops later ones', () => {
    const segments = [seg('a', 0, 20), seg('b', 25, null)]
    const { keep, drop } = closeAt(segments, at(50))
    expect(drop).toEqual([])
    expect(keep.map((s) => s.endedAt)).toEqual([at(20), at(50)])
    expect(activeMs(keep, at(500))).toBe(45 * MINUTE)
  })

  it('drops segments that start after the corrected end', () => {
    const { keep, drop } = closeAt([seg('a', 0, 20), seg('b', 25, null)], at(10))
    expect(drop).toEqual(['b'])
    expect(keep).toEqual([{ ...seg('a', 0, 20), endedAt: at(10) }])
  })
})

import { describe, expect, it } from 'vitest'
import {
  activeMs,
  closeAt,
  forgottenSegment,
  intervalReminder,
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

describe('intervalReminder', () => {
  it('is off in free mode', () => {
    expect(intervalReminder('free', [seg('a', 0, null)], at(5))).toBeNull()
  })

  it('counts work from the start of the stretch, across unit switches', () => {
    const segments = [seg('a', 0, 10), seg('b', 10, null, 'u2')]
    const r = intervalReminder('pomodoro25', segments, at(23))!
    expect(r.phase).toBe('work')
    expect(r.remainingMs).toBe(2 * MINUTE)
  })

  it('restarts work after a pause', () => {
    const segments = [seg('a', 0, 25), seg('b', 30, null)]
    expect(intervalReminder('pomodoro25', segments, at(40))!.remainingMs).toBe(15 * MINUTE)
  })

  it('goes negative when the break is due, but never pauses by itself', () => {
    const segments = [seg('a', 0, null)]
    const r = intervalReminder('pomodoro50', segments, at(55))!
    expect(r.remainingMs).toBe(-5 * MINUTE)
    expect(timerStatus(segments)).toBe('running')
  })

  it('counts the break from the last segment end', () => {
    const r = intervalReminder('pomodoro25', [seg('a', 0, 25)], at(27))!
    expect(r).toEqual({ phase: 'break', totalMs: 5 * MINUTE, remainingMs: 3 * MINUTE })
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

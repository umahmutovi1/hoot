import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { autoRhythmId, sessionReminder, sessionShape, shapeTotals } from './shape'
import { MINUTE, resolvePreset } from './timer'

const shapeOf = (minutes: number, id: string) => sessionShape(minutes, resolvePreset(id))

describe('autoRhythmId', () => {
  it('keeps short sessions in one stretch and splits medium ones in two', () => {
    expect(autoRhythmId(15, 'standard')).toBe('rhythm:15:5')
    expect(autoRhythmId(30, 'standard')).toBe('rhythm:30:5')
    expect(autoRhythmId(45, 'standard')).toBe('rhythm:20:5')
    expect(autoRhythmId(90, 'pomodoro')).toBe('pomodoro')
  })
})

describe('sessionShape', () => {
  it('30 min in "Hoot bira" is one stretch without a break', () => {
    expect(shapeOf(30, autoRhythmId(30, 'standard'))).toEqual([{ kind: 'work', min: 30 }])
  })

  it('45 min is two halves with a short break', () => {
    expect(shapeOf(45, autoRhythmId(45, 'standard'))).toEqual([
      { kind: 'work', min: 20 },
      { kind: 'break', min: 5 },
      { kind: 'work', min: 20 },
    ])
  })

  it('never puts a break in a session shorter than the interval', () => {
    expect(shapeOf(30, 'standard')).toEqual([{ kind: 'work', min: 30 }])
    expect(shapeOf(60, 'standard')).toEqual([{ kind: 'work', min: 60 }])
  })

  it('cycles the preset in long sessions', () => {
    expect(shapeOf(120, 'standard')).toEqual([
      { kind: 'work', min: 50 },
      { kind: 'break', min: 15 },
      { kind: 'work', min: 55 },
    ])
    expect(shapeTotals(shapeOf(60, 'pomodoro'))).toEqual({ studyMin: 55, breaks: 1 })
  })

  it('always adds up to the session length and starts and ends with study', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 240 }),
        fc.constantFrom('standard', 'pomodoro', 'flow', 'free', 'rhythm:25:5', 'rhythm:40:10'),
        (minutes, id) => {
          const shape = shapeOf(minutes, id)
          expect(shape.reduce((a, s) => a + s.min, 0)).toBe(minutes)
          expect(shape[0]!.kind).toBe('work')
          expect(shape.at(-1)!.kind).toBe('work')
        },
      ),
    )
  })
})

describe('sessionReminder', () => {
  const start = new Date('2026-11-28T10:00:00Z')
  const at = (min: number) => new Date(start.getTime() + min * MINUTE)
  const running = [{ id: 's1', unitId: null, startedAt: start, endedAt: null }]

  it('counts down to the end when no break fits before it', () => {
    const r = sessionReminder(resolvePreset('standard'), running, at(10), 30)
    expect(r).toMatchObject({ phase: 'end', remainingMs: 20 * MINUTE })
    expect(sessionReminder(resolvePreset('standard'), running, at(31), 30)?.remainingMs).toBe(
      -1 * MINUTE,
    )
  })

  it('keeps the break countdown when the session goes on after it', () => {
    const r = sessionReminder(resolvePreset('rhythm:20:5'), running, at(10), 45)
    expect(r).toMatchObject({ phase: 'work', remainingMs: 10 * MINUTE })
  })

  it('without a planned length it is the preset reminder', () => {
    expect(sessionReminder(resolvePreset('standard'), running, at(10), null)).toMatchObject({
      phase: 'work',
    })
  })
})

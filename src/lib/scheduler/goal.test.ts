import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { isConditional, priorityFromGoal } from './goal'

describe('priorityFromGoal', () => {
  it('maps the goal to a priority as in the PRD', () => {
    expect(priorityFromGoal({ conditional: true, targetGrade: null })).toBe(5)
    expect(priorityFromGoal({ conditional: true, targetGrade: 6 })).toBe(5)
    expect(priorityFromGoal({ conditional: false, targetGrade: null })).toBe(3)
    expect(priorityFromGoal({ conditional: false, targetGrade: 6 })).toBe(2)
    expect(priorityFromGoal({ conditional: false, targetGrade: 7 })).toBe(3)
    expect(priorityFromGoal({ conditional: false, targetGrade: 8 })).toBe(3)
    expect(priorityFromGoal({ conditional: false, targetGrade: 9 })).toBe(4)
    expect(priorityFromGoal({ conditional: false, targetGrade: 10 })).toBe(4)
  })

  it('never picks priority 1 and never lowers priority for a higher grade', () => {
    const grade = fc.option(fc.integer({ min: 6, max: 10 }), { nil: null })
    fc.assert(
      fc.property(fc.boolean(), grade, (conditional, targetGrade) => {
        const p = priorityFromGoal({ conditional, targetGrade })
        expect(p).toBeGreaterThanOrEqual(2)
        expect(p).toBeLessThanOrEqual(5)
      }),
    )
    for (let g = 6; g < 10; g++)
      expect(priorityFromGoal({ conditional: false, targetGrade: g + 1 })).toBeGreaterThanOrEqual(
        priorityFromGoal({ conditional: false, targetGrade: g }),
      )
  })

  it('round-trips the switch through the priority', () => {
    expect(isConditional(priorityFromGoal({ conditional: true, targetGrade: 9 }))).toBe(true)
    expect(isConditional(priorityFromGoal({ conditional: false, targetGrade: 10 }))).toBe(false)
  })
})

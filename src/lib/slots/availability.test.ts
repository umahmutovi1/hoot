import { describe, expect, it } from 'vitest'
import { editWeeklySlots } from './availability'
describe('Sprint 17 weekly slot actions', () => {
  const rules = [
    { weekday: 0, startMin: 600, endMin: 1200, overClasses: true },
    { weekday: 5, startMin: 900, endMin: 1200 },
  ]
  it('splits a rule and preserves class overrides and the other day kind', () => {
    expect(
      editWeeklySlots(rules, { kind: 'avoid_slot', weekend: false, part: 'afternoon' }),
    ).toEqual([
      { weekday: 0, startMin: 600, endMin: 900, overClasses: true },
      { weekday: 0, startMin: 1140, endMin: 1200, overClasses: true },
      rules[1],
    ])
  })
  it('adds only uncovered minutes, never class overrides; repeated acceptance is idempotent', () => {
    const action = { kind: 'add_slot' as const, weekend: true, part: 'afternoon' as const }
    const changed = editWeeklySlots(rules, action)
    expect(changed).toContainEqual({ weekday: 6, startMin: 900, endMin: 1140, overClasses: false })
    expect(changed.filter((r) => r.weekday === 5)).toEqual([rules[1]])
    expect(editWeeklySlots(changed, action)).toEqual(changed)
  })
})

it('Sprint 17 never opens morning or evening sleep hours when adding a slot', () => {
  const rhythm = { wake: [480, 600] as [number, number], sleep: [1320, 1380] as [number, number] }
  const morning = editWeeklySlots([], { kind: 'add_slot', weekend: false, part: 'morning' }, rhythm)
  expect(morning).toHaveLength(5)
  expect(morning.every((r) => r.startMin === 480 && r.endMin === 720)).toBe(true)
  const night = editWeeklySlots([], { kind: 'add_slot', weekend: false, part: 'night' }, rhythm)
  expect(night).toEqual([])
})

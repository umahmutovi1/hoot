import { describe, expect, it } from 'vitest'
import { milestoneBetween, reachedRepeated, remembered, type Progress } from '.'

const at = (p: Partial<Progress>): Progress => ({
  date: '2026-11-03',
  week: '2026-11-02',
  doneToday: 0,
  plannedToday: 3,
  doneWeek: 0,
  plannedWeek: 600,
  ...p,
})

describe('milestoneBetween', () => {
  it('needs a previous snapshot of the same day', () => {
    expect(milestoneBetween(null, at({ doneToday: 1 }))).toBeNull()
    expect(milestoneBetween(at({ date: '2026-11-02' }), at({ doneToday: 1 }))).toBeNull()
  })

  it('celebrates a block, then the day', () => {
    expect(milestoneBetween(at({}), at({ doneToday: 1 }))).toBe('block')
    expect(milestoneBetween(at({ doneToday: 2 }), at({ doneToday: 3 }))).toBe('day')
  })

  it('celebrates the day once, then blocks over the plan as blocks', () => {
    expect(milestoneBetween(at({ doneToday: 3 }), at({ doneToday: 4 }))).toBe('block')
  })

  it('the week wins over the day', () => {
    expect(
      milestoneBetween(at({ doneToday: 2, doneWeek: 550 }), at({ doneToday: 3, doneWeek: 610 })),
    ).toBe('week')
  })

  it('stays quiet without new work, and on a day without a plan the block still counts', () => {
    expect(milestoneBetween(at({ doneToday: 1 }), at({ doneToday: 1 }))).toBeNull()
    expect(milestoneBetween(at({ plannedToday: 0 }), at({ plannedToday: 0, doneToday: 1 }))).toBe(
      'block',
    )
  })

  it('a replan that lowers the week target does not celebrate by itself', () => {
    expect(
      milestoneBetween(at({ doneWeek: 500 }), at({ doneWeek: 500, plannedWeek: 450 })),
    ).toBeNull()
  })
})

describe('remembered', () => {
  it('keeps the highest counts of the day and week, so loading does not celebrate later', () => {
    const before = at({ doneToday: 2, doneWeek: 590 })
    const loading = at({ doneToday: 0, doneWeek: 0 })
    const kept = remembered(before, loading)
    expect(kept).toMatchObject({ doneToday: 2, doneWeek: 590 })
    expect(milestoneBetween(kept, at({ doneToday: 2, doneWeek: 590 }))).toBeNull()
  })

  it('starts over on a new day and a new week', () => {
    const before = at({ doneToday: 3, doneWeek: 600 })
    const kept = remembered(before, at({ date: '2026-11-09', week: '2026-11-09' }))
    expect(kept).toMatchObject({ doneToday: 0, doneWeek: 0 })
  })
})

describe('reachedRepeated', () => {
  it('only a unit that crosses to level 3', () => {
    expect(reachedRepeated([{ kind: 'unit', levelBefore: 2, levelAfter: 3 }])).toBe(true)
    expect(reachedRepeated([{ kind: 'unit', levelBefore: 3, levelAfter: 3 }])).toBe(false)
    expect(reachedRepeated([{ kind: 'card', levelBefore: 2, levelAfter: 3 }])).toBe(false)
  })
})

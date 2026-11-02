import { describe, expect, it } from 'vitest'
import { recallShare, weekWindow } from './week'
describe('Sprint 17 weekly review', () => {
  it('shows the same week on Sunday and on a Monday catch-up, with next week starting Monday', () => {
    expect(weekWindow('2026-11-01')).toEqual(weekWindow('2026-11-02'))
    expect(weekWindow('2026-11-03').nextFrom).toBe('2026-11-02')
    expect(weekWindow('2026-11-08').from).toBe('2026-11-02')
  })
  it('counts problems, questions and reviews as recall, including zero-history unknown', () => {
    expect(recallShare([])).toBeNull()
    expect(
      recallShare([
        { mode: 'reading', minutes: 120 },
        { mode: 'questions', minutes: 30 },
        { mode: 'problems', minutes: 30 },
      ]),
    ).toBeCloseTo(1 / 3)
  })
})

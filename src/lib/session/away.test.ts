import { describe, expect, it } from 'vitest'
import { addAway, awaySeconds, MIN_AWAY_SEC } from './away'

const at = (sec: number) => new Date(Date.UTC(2026, 9, 29, 10, 0, sec))

describe('awaySeconds', () => {
  it('counts a leave from the timestamps', () => {
    expect(awaySeconds(at(0), at(42))).toBe(42)
  })

  it('a glance shorter than the minimum is not a leave', () => {
    expect(awaySeconds(at(0), at(MIN_AWAY_SEC - 1))).toBeNull()
    expect(awaySeconds(at(0), at(MIN_AWAY_SEC))).toBe(MIN_AWAY_SEC)
  })

  it('a clock that went back is not a leave', () => {
    expect(awaySeconds(at(30), at(0))).toBeNull()
  })
})

describe('addAway', () => {
  it('adds one leave and its seconds', () => {
    expect(addAway({ app_leaves: 2, app_away_sec: 100 }, 30)).toEqual({
      app_leaves: 3,
      app_away_sec: 130,
    })
  })
})

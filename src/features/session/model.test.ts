import { describe, expect, it } from 'vitest'
import { endAt, formatClock } from './model'

describe('endAt', () => {
  const start = new Date(2026, 9, 21, 14, 5, 30)
  const now = new Date(2026, 9, 22, 2, 0)

  it('takes the time on the day the segment started', () => {
    expect(endAt(start, '14:30', now)).toEqual(new Date(2026, 9, 21, 14, 30))
  })

  it('rolls over midnight', () => {
    expect(endAt(start, '01:10', now)).toEqual(new Date(2026, 9, 22, 1, 10))
  })

  it('the start minute is the start', () => {
    expect(endAt(start, '14:05', now)).toEqual(start)
  })

  it('never after now, never malformed', () => {
    expect(endAt(start, '03:00', now)).toBeNull()
    expect(endAt(start, 'x', now)).toBeNull()
  })
})

describe('formatClock', () => {
  it('shows m:ss, then h:mm:ss', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock((23 * 60 + 41) * 1000)).toBe('23:41')
    expect(formatClock((3600 + 5 * 60 + 9) * 1000)).toBe('1:05:09')
  })
})

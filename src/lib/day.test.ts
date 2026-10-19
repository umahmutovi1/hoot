import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayStartInstant,
  diffDays,
  localDay,
  minutesIntoDay,
  startOfWeek,
  weekdayOf,
  zonedInstant,
  type DayBoundary,
} from './day'

const sarajevo: DayBoundary = { timeZone: 'Europe/Sarajevo', dayStartMin: 240 }

describe('localDay', () => {
  it('counts 01:30 as the previous day', () => {
    // 2026-10-20 01:30 in Sarajevo (CEST, UTC+2)
    expect(localDay(new Date('2026-10-19T23:30:00Z'), sarajevo)).toBe('2026-10-19')
  })

  it('starts the new day exactly at 04:00', () => {
    expect(localDay(new Date('2026-10-20T01:59:00Z'), sarajevo)).toBe('2026-10-19')
    expect(localDay(new Date('2026-10-20T02:00:00Z'), sarajevo)).toBe('2026-10-20')
  })

  it('uses the profile zone, not UTC', () => {
    const ny: DayBoundary = { timeZone: 'America/New_York', dayStartMin: 240 }
    // 2026-10-20 03:00 UTC = 23:00 on the 19th in New York
    expect(localDay(new Date('2026-10-20T03:00:00Z'), ny)).toBe('2026-10-19')
  })

  it('keeps the boundary at 04:00 wall time on DST nights', () => {
    // Spring forward 2026-03-29 (02:00 → 03:00): 04:00 CEST = 02:00 UTC
    expect(localDay(new Date('2026-03-29T01:59:00Z'), sarajevo)).toBe('2026-03-28')
    expect(localDay(new Date('2026-03-29T02:00:00Z'), sarajevo)).toBe('2026-03-29')
    // Fall back 2026-10-25 (03:00 → 02:00): 04:00 CET = 03:00 UTC
    expect(localDay(new Date('2026-10-25T02:59:00Z'), sarajevo)).toBe('2026-10-24')
    expect(localDay(new Date('2026-10-25T03:00:00Z'), sarajevo)).toBe('2026-10-25')
  })

  it('supports a midnight boundary', () => {
    const midnight: DayBoundary = { timeZone: 'Europe/Sarajevo', dayStartMin: 0 }
    expect(localDay(new Date('2026-10-19T23:30:00Z'), midnight)).toBe('2026-10-20')
  })
})

describe('minutesIntoDay', () => {
  it('is 0 at the boundary and wraps after midnight', () => {
    expect(minutesIntoDay(new Date('2026-10-20T02:00:00Z'), sarajevo)).toBe(0)
    expect(minutesIntoDay(new Date('2026-10-20T07:00:00Z'), sarajevo)).toBe(300)
    expect(minutesIntoDay(new Date('2026-10-19T23:30:00Z'), sarajevo)).toBe(1290)
  })
})

describe('calendar arithmetic', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('counts days between dates', () => {
    expect(diffDays('2026-10-19', '2026-10-26')).toBe(7)
    expect(diffDays('2026-10-26', '2026-10-19')).toBe(-7)
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('numbers weekdays from Monday', () => {
    expect(weekdayOf('2026-10-19')).toBe(0)
    expect(weekdayOf('2026-10-25')).toBe(6)
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19')
  })
})

describe('zonedInstant', () => {
  it('converts wall time in summer and winter', () => {
    expect(zonedInstant('2026-10-19', 9 * 60, 'Europe/Sarajevo').toISOString()).toBe(
      '2026-10-19T07:00:00.000Z',
    )
    expect(zonedInstant('2026-12-01', 9 * 60, 'Europe/Sarajevo').toISOString()).toBe(
      '2026-12-01T08:00:00.000Z',
    )
  })

  it('round-trips with localDay at the day start', () => {
    for (const date of ['2026-03-29', '2026-10-25', '2026-06-15']) {
      expect(localDay(dayStartInstant(date, sarajevo), sarajevo)).toBe(date)
    }
  })
})

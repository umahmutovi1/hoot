import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { IcsError, parseIcs, type IcsEvent } from './ics.ts'

// Vitest runs from the repo root (jsdom gives import.meta.url no file path).
const fixture = (name: string) =>
  readFileSync(join(process.cwd(), `supabase/functions/_shared/fixtures/ics/${name}.ics`), 'utf8')
const options = {
  from: new Date('2026-10-19T00:00:00Z'),
  to: new Date('2026-12-31T00:00:00Z'),
  timeZone: 'Europe/Sarajevo',
}
const iso = (e: IcsEvent) => [e.startsAt.toISOString(), e.endsAt.toISOString()]

describe('parseIcs · Google', () => {
  const events = parseIcs(fixture('google'), options)
  const gym = events.filter((e) => e.uid === 'gym-weekly@google.com')

  it('expands a weekly RRULE in the feed zone, across the DST change', () => {
    expect(iso(gym[0]!)).toEqual(['2026-10-19T16:00:00.000Z', '2026-10-19T17:30:00.000Z'])
    expect(gym.map((e) => e.startsAt.toISOString())).toContain('2026-11-09T17:00:00.000Z')
  })

  it('drops EXDATE and moves a RECURRENCE-ID override', () => {
    const starts = gym.map((e) => e.startsAt.toISOString())
    expect(starts).not.toContain('2026-10-26T17:00:00.000Z')
    expect(starts).not.toContain('2026-11-02T17:00:00.000Z')
    const moved = gym.find((e) => e.startsAt.toISOString() === '2026-11-03T19:00:00.000Z')
    expect(moved?.title).toBe('Teretana (pomjereno)')
    expect(gym).toHaveLength(6) // 19.10, 3.11 (moved), 9., 16., 23., 30.11; 26.10 excluded
  })

  it('stops at UNTIL', () => {
    expect(gym.at(-1)!.startsAt.toISOString()).toBe('2026-11-30T17:00:00.000Z')
  })

  it('keeps all-day events as UTC dates, end exclusive', () => {
    const trip = events.find((e) => e.uid === 'trip@google.com')!
    expect(trip.allDay).toBe(true)
    expect(iso(trip)).toEqual(['2026-10-28T00:00:00.000Z', '2026-10-30T00:00:00.000Z'])
  })

  it('drops free (TRANSPARENT) events, recurring or not', () => {
    expect(events.some((e) => e.uid.startsWith('birthday'))).toBe(false)
    expect(events.some((e) => e.uid === 'free-call@google.com')).toBe(false)
    expect(events).toHaveLength(7)
  })

  it('keeps title and location', () => {
    expect(gym[0]).toMatchObject({ title: 'Teretana', location: 'Fitness centar' })
  })
})

describe('parseIcs · Outlook', () => {
  const events = parseIcs(fixture('outlook'), options)

  it('reads Windows zone names from the feed VTIMEZONE and stops at COUNT', () => {
    const work = events.filter((e) => e.title === 'Posao')
    expect(iso(work[0]!)).toEqual(['2026-10-20T07:00:00.000Z', '2026-10-20T11:00:00.000Z'])
    expect(work.map((e) => e.startsAt.toISOString())).toEqual([
      '2026-10-20T07:00:00.000Z',
      '2026-10-22T07:00:00.000Z',
      '2026-10-29T08:00:00.000Z',
      '2026-11-03T08:00:00.000Z',
      '2026-11-05T08:00:00.000Z',
    ])
  })

  it('drops a cancelled occurrence and a cancelled event', () => {
    expect(events.some((e) => e.title?.includes('Otkazano'))).toBe(false)
    expect(events.some((e) => e.title?.includes('Sastanak'))).toBe(false)
  })
})

describe('parseIcs · iCloud', () => {
  const events = parseIcs(fixture('icloud'), options)

  it('resolves an IANA TZID without a VTIMEZONE', () => {
    expect(iso(events.find((e) => e.title === 'Ples')!)).toEqual([
      '2026-10-24T08:00:00.000Z',
      '2026-10-24T10:00:00.000Z',
    ])
  })

  it('reads floating times in the profile zone and honours DURATION', () => {
    expect(iso(events.find((e) => e.title?.startsWith('Doručak'))!)).toEqual([
      '2026-10-25T07:00:00.000Z',
      '2026-10-25T08:30:00.000Z',
    ])
  })

  it('gives an all-day event without DTEND one day', () => {
    expect(iso(events.find((e) => e.allDay)!)).toEqual([
      '2026-11-01T00:00:00.000Z',
      '2026-11-02T00:00:00.000Z',
    ])
  })
})

describe('parseIcs · Moodle', () => {
  it('reads UTC deadlines, also zero-length ones', () => {
    const events = parseIcs(fixture('moodle'), options)
    expect(events.map((e) => e.title)).toEqual(['Kviz 1 otvoren', 'Zadaća 2 se predaje'])
    expect(iso(events[1]!)).toEqual(['2026-11-04T22:59:00.000Z', '2026-11-04T22:59:00.000Z'])
  })
})

describe('parseIcs · horizon and errors', () => {
  it('keeps only events that overlap the window', () => {
    const narrow = { ...options, to: new Date('2026-10-25T00:00:00Z') }
    const events = parseIcs(fixture('google'), narrow)
    expect(events.map((e) => e.uid)).toEqual(['gym-weekly@google.com'])
  })

  it('rejects text that is not a calendar', () => {
    expect(() => parseIcs('<html>login</html>', options)).toThrow(IcsError)
  })
})

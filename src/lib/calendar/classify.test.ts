import { describe, expect, it } from 'vitest'
import { ruleKind, weeklySeries, type ClassifiedEvent } from './classify'

const at = (iso: string, minutes = 60, title: string | null = 'x', id = iso): ClassifiedEvent => ({
  id,
  title,
  startsAt: new Date(iso),
  endsAt: new Date(Date.parse(iso) + minutes * 60_000),
  allDay: false,
})

const ctx = { deadlineFeed: false, inSeries: false, subjectNames: ['Matematika 1', 'Fizika'] }

describe('ruleKind', () => {
  it('reads exams and deadlines from Bosnian and English titles without diacritics', () => {
    expect(ruleKind(at('2026-11-02T09:00:00Z', 90, 'Kolokvij iz Matematike'), ctx)).toBe('exam')
    expect(ruleKind(at('2026-11-02T09:00:00Z', 90, 'II parcijalni ispit'), ctx)).toBe('exam')
    expect(ruleKind(at('2026-11-02T09:00:00Z', 60, 'Predaja seminarskog'), ctx)).toBe('deadline')
    expect(ruleKind(at('2026-11-02T09:00:00Z', 60, 'Zadaća 3'), ctx)).toBe('deadline')
    expect(ruleKind(at('2026-11-02T09:00:00Z', 60, 'Rok za projekat'), ctx)).toBe('deadline')
    expect(ruleKind(at('2026-11-02T09:00:00Z', 60, 'Midterm exam'), ctx)).toBe('exam')
  })

  it('does not read a word that only contains a keyword', () => {
    expect(ruleKind(at('2026-11-02T09:00:00Z', 60, 'Prokrastinacija sa Anom'), ctx)).toBeNull()
  })

  it('makes deadline feeds and events without duration deadlines', () => {
    expect(
      ruleKind(at('2026-11-02T09:00:00Z', 60, 'Bilo šta'), { ...ctx, deadlineFeed: true }),
    ).toBe('deadline')
    expect(ruleKind(at('2026-11-02T22:59:00Z', 0, 'Quiz 2 closes'), ctx)).toBe('deadline')
  })

  it('reads lectures from a word or from a weekly series that names a subject', () => {
    expect(ruleKind(at('2026-11-02T09:00:00Z', 90, 'Predavanje'), ctx)).toBe('lecture')
    expect(ruleKind(at('2026-11-02T09:00:00Z', 90, 'Vježbe A2'), ctx)).toBe('lecture')
    expect(ruleKind(at('2026-11-02T09:00:00Z', 90, 'Matematika'), ctx)).toBeNull()
    expect(ruleKind(at('2026-11-02T09:00:00Z', 90, 'Matematika'), { ...ctx, inSeries: true })).toBe(
      'lecture',
    )
    expect(
      ruleKind(at('2026-11-02T09:00:00Z', 90, 'Trening'), { ...ctx, inSeries: true }),
    ).toBeNull()
  })

  it('treats untitled and all-day events as busy and leaves the rest to the AI', () => {
    expect(ruleKind(at('2026-11-02T09:00:00Z', 60, null), ctx)).toBe('busy')
    expect(ruleKind({ ...at('2026-11-02T00:00:00Z', 1440, 'Rođendan'), allDay: true }, ctx)).toBe(
      'busy',
    )
    expect(ruleKind(at('2026-11-02T09:00:00Z', 60, 'Kafa sa Anom'), ctx)).toBeNull()
  })
})

describe('weeklySeries', () => {
  it('finds a title repeated at the same weekday and local time', () => {
    const tz = 'Europe/Sarajevo'
    const events = [
      // Across the DST change the UTC hour moves, the local one stays 09:00.
      at('2026-10-19T07:00:00Z', 90, 'Fizika', 'a'),
      at('2026-10-26T08:00:00Z', 90, 'Fizika', 'b'),
      at('2026-11-02T08:00:00Z', 90, 'Fizika', 'c'),
      at('2026-11-03T08:00:00Z', 90, 'Fizika', 'other-day'),
      at('2026-11-04T10:00:00Z', 60, 'Sastanak', 'd'),
    ]
    expect([...weeklySeries(events, tz)].sort()).toEqual(['a', 'b', 'c'])
  })
})

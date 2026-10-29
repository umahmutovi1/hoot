import { describe, expect, it } from 'vitest'
import {
  calendarProposals,
  examKey,
  inGoogleAlready,
  linkedLectureEvents,
  seriesKey,
  type MatchEvent,
} from './match'

const tz = 'Europe/Sarajevo'
const now = new Date('2026-11-01T08:00:00Z')
const subjects = [
  { id: 'mat', name: 'Matematika 1' },
  { id: 'fiz', name: 'Fizika' },
]

// Tuesdays 09:00–10:30 Sarajevo (08:00Z in winter).
const lecture = (id: string, date: string, title = 'Matematika 1 predavanje'): MatchEvent => ({
  id,
  feedId: 'g',
  uid: `series_${date}`,
  title,
  startsAt: new Date(`${date}T08:00:00Z`),
  endsAt: new Date(`${date}T09:30:00Z`),
  kind: 'lecture',
  inSeries: true,
})

const exam = (id: string, iso: string, title = 'Kolokvij Fizika'): MatchEvent => ({
  id,
  feedId: 'g',
  uid: `uid-${id}`,
  title,
  startsAt: new Date(iso),
  endsAt: new Date(Date.parse(iso) + 2 * 3_600_000),
  kind: 'exam',
  inSeries: false,
})

const lectures = [
  lecture('l1', '2026-11-03'),
  lecture('l2', '2026-11-10'),
  lecture('l3', '2026-11-17'),
]

const base = { matches: [], entries: [], exams: [], subjects, timeZone: tz, now }

describe('calendarProposals', () => {
  it('offers a lecture series once, with weekday, local time, subject and kind', () => {
    const { lectures: out } = calendarProposals({ ...base, events: lectures })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      weekday: 1,
      startMin: 540,
      endMin: 630,
      subjectId: 'mat',
      classKind: 'lecture',
      status: 'new',
      eventIds: ['l1', 'l2', 'l3'],
    })
  })

  it('marks a series Hoot already has as the same, and skips decided ones', () => {
    const entries = [{ id: 'e1', subjectId: 'mat', weekday: 1, startMin: 545, endMin: 630 }]
    const same = calendarProposals({ ...base, events: lectures, entries }).lectures[0]!
    expect(same.status).toBe('same')
    expect(same.existingId).toBe('e1')
    const matches = [
      {
        feed_id: 'g',
        match_key: seriesKey(lectures[0]!, tz),
        kind: 'lecture',
        target_id: 'e1',
        decision: 'distinct',
        seen_start: null,
      },
    ]
    expect(calendarProposals({ ...base, events: lectures, entries, matches }).lectures).toEqual([])
  })

  it('offers exams, same when Hoot has an exam that day, changed when a linked one moved', () => {
    const e = exam('x1', '2026-11-20T09:00:00Z')
    const hootExam = { id: 'a1', subjectId: 'fiz', at: '2026-11-20T08:00:00Z' }
    expect(calendarProposals({ ...base, events: [e] }).exams[0]).toMatchObject({
      status: 'new',
      subjectId: 'fiz',
    })
    expect(calendarProposals({ ...base, events: [e], exams: [hootExam] }).exams[0]).toMatchObject({
      status: 'same',
      existingId: 'a1',
    })
    const linked = {
      feed_id: 'g',
      match_key: examKey(e),
      kind: 'exam',
      target_id: 'a1',
      decision: 'linked',
      seen_start: '2026-11-18T09:00:00.000Z',
    }
    expect(
      calendarProposals({ ...base, events: [e], exams: [hootExam], matches: [linked] }).exams[0],
    ).toMatchObject({ status: 'changed', existingId: 'a1', previousAt: hootExam.at })
    const unchanged = { ...linked, seen_start: e.startsAt.toISOString() }
    expect(
      calendarProposals({ ...base, events: [e], exams: [hootExam], matches: [unchanged] }).exams,
    ).toEqual([])
  })

  it('ignores past events', () => {
    const past = exam('p', '2026-10-20T09:00:00Z')
    expect(calendarProposals({ ...base, events: [past] }).exams).toEqual([])
  })
})

describe('linked items', () => {
  const linked = {
    feed_id: 'g',
    match_key: seriesKey(lectures[0]!, tz),
    kind: 'lecture',
    target_id: 'e1',
    decision: 'linked',
    seen_start: null,
  }

  it('finds the lecture events covered by a linked class', () => {
    expect([...linkedLectureEvents(lectures, [linked], tz)]).toEqual(['l1', 'l2', 'l3'])
  })

  it('lists Hoot items that are already in Google only for Google feeds', () => {
    expect(inGoogleAlready([linked], new Set(['g'])).entries.has('e1')).toBe(true)
    expect(inGoogleAlready([linked], new Set(['other'])).entries.size).toBe(0)
  })
})

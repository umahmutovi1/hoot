import { describe, expect, it } from 'vitest'
import { calendarItems, diffItems } from './items'

const input = {
  blocks: [
    {
      id: 'b1',
      start: new Date('2026-11-02T09:00:00Z'),
      minutes: 50,
      title: 'Matematika — Poglavlje 3',
      description: 'str. 40–52',
      color: '#2563EB',
    },
  ],
  exams: [
    {
      id: 'e1',
      subjectId: 's1',
      from: '2026-12-01',
      to: '2026-12-03',
      title: 'Ispit: Matematika',
      color: null,
    },
  ],
  deadlines: [
    {
      id: 'd1',
      subjectId: null,
      due: new Date('2026-11-20T22:59:00Z'),
      title: 'Rok: Seminarski',
      color: null,
    },
  ],
  classes: [
    {
      entryId: 'c1',
      date: '2026-11-03',
      start: new Date('2026-11-03T07:00:00Z'),
      end: new Date('2026-11-03T08:30:00Z'),
      title: 'Matematika · predavanje',
      location: 'A1',
      color: '#2563EB',
    },
  ],
}

describe('calendarItems', () => {
  it('builds keyed items with the start link, the exam range and the class occurrence', () => {
    const items = calendarItems(input)
    expect(items.map((i) => i.key)).toEqual([
      'block:b1',
      'exam:e1',
      'deadline:d1',
      'class:c1:2026-11-03',
    ])
    expect(items[0]).toMatchObject({
      ends_at: '2026-11-02T09:50:00.000Z',
      url_path: '/?block=b1',
    })
    expect(items[1]).toMatchObject({
      all_day: true,
      starts_at: '2026-12-01T00:00:00.000Z',
      ends_at: '2026-12-04T00:00:00.000Z',
      url_path: '/subjects/s1',
    })
    expect(items[2]!.url_path).toBeNull()
  })

  it('keeps the hash for the same input', () => {
    expect(calendarItems(input).map((i) => i.hash)).toEqual(calendarItems(input).map((i) => i.hash))
  })
})

describe('diffItems', () => {
  it('writes new and changed items and deletes the gone ones, but keeps the past', () => {
    const [block, exam] = calendarItems(input)
    const diff = diffItems(
      [block!, exam!],
      [
        { key: 'block:b1', hash: block!.hash, starts_at: block!.starts_at },
        { key: 'exam:e1', hash: 'old', starts_at: exam!.starts_at },
        { key: 'deadline:gone', hash: 'x', starts_at: '2026-11-05T10:00:00.000Z' },
        { key: 'block:yesterday', hash: 'y', starts_at: '2026-10-31T10:00:00.000Z' },
      ],
      new Date('2026-11-01T03:00:00.000Z'),
    )
    expect(diff.upsert.map((i) => i.key)).toEqual(['exam:e1'])
    expect(diff.remove).toEqual(['deadline:gone'])
  })
})

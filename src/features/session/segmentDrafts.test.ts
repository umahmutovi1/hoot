import { describe, expect, it } from 'vitest'
import { fromDrafts, toDrafts } from './segmentDrafts'

const tz = 'Europe/Sarajevo'
const d = (id: string, start: string, end: string) => ({ id, unitId: null, start, end })

describe('fromDrafts', () => {
  it('places times on the date in the zone', () => {
    const out = fromDrafts(
      [d('a', '14:05', '14:30'), d('b', '14:35', '15:00')],
      '2026-10-21',
      tz,
      's',
    )
    expect('segments' in out && out.segments.map((s) => [s.started_at, s.ended_at])).toEqual([
      ['2026-10-21T12:05:00.000Z', '2026-10-21T12:30:00.000Z'],
      ['2026-10-21T12:35:00.000Z', '2026-10-21T13:00:00.000Z'],
    ])
  })

  it('crosses midnight', () => {
    const out = fromDrafts(
      [d('a', '23:30', '00:20'), d('b', '00:30', '01:00')],
      '2026-10-21',
      tz,
      's',
    )
    expect('segments' in out && out.segments.map((s) => s.ended_at)).toEqual([
      '2026-10-21T22:20:00.000Z',
      '2026-10-21T23:00:00.000Z',
    ])
  })

  it('rejects overlaps, bad times and nothing', () => {
    expect(
      fromDrafts([d('a', '14:00', '15:00'), d('b', '14:30', '15:10')], '2026-10-21', tz, 's'),
    ).toEqual({
      error: 'overlap',
    })
    expect(fromDrafts([d('a', '', '14:00')], '2026-10-21', tz, 's')).toEqual({ error: 'time' })
    expect(fromDrafts([], '2026-10-21', tz, 's')).toEqual({ error: 'empty' })
  })

  it('keeps the seconds of untouched times, also for segments under a minute', () => {
    const segs = [
      {
        id: 'a',
        session_id: 's',
        unit_id: null,
        started_at: '2026-10-21T12:05:10.000Z',
        ended_at: '2026-10-21T12:05:40.000Z',
      },
    ]
    expect(fromDrafts(toDrafts(segs, tz), '2026-10-21', tz, 's', segs)).toEqual({ segments: segs })
    const longer = fromDrafts(
      [{ ...toDrafts(segs, tz)[0]!, end: '14:35' }],
      '2026-10-21',
      tz,
      's',
      segs,
    )
    expect('segments' in longer && longer.segments[0]).toMatchObject({
      started_at: '2026-10-21T12:05:10.000Z',
      ended_at: '2026-10-21T12:35:00.000Z',
    })
  })

  it('round-trips with toDrafts', () => {
    const segs = [
      {
        id: 'a',
        session_id: 's',
        unit_id: 'u',
        started_at: '2026-10-21T12:05:00.000Z',
        ended_at: '2026-10-21T12:30:00.000Z',
      },
    ]
    const drafts = toDrafts(segs, tz)
    expect(drafts).toEqual([{ id: 'a', unitId: 'u', start: '14:05', end: '14:30' }])
    expect(fromDrafts(drafts, '2026-10-21', tz, 's')).toEqual({ segments: segs })
  })
})

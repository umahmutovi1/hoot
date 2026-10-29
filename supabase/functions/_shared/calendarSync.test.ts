import { describe, expect, it } from 'vitest'
import {
  blockTimesFromEvent,
  HOOT_KEY,
  itemHash,
  nearestColorId,
  reconcile,
  toBusyRow,
  toEventBody,
  type CalendarItem,
  type CalendarLink,
} from './calendarSync.ts'
import { allowedOrigin, allowedPath, signState, verifyState } from './google.ts'

function item(key: string, start: string, extra: Partial<CalendarItem> = {}): CalendarItem {
  const base = {
    key,
    kind: 'block' as const,
    ref_id: key.split(':')[1] ?? key,
    starts_at: start,
    ends_at: new Date(Date.parse(start) + 3_600_000).toISOString(),
    all_day: false,
    title: 'Matematika — Poglavlje 3',
    description: null,
    url_path: `/?block=${key.split(':')[1]}`,
    color: '#2563EB',
    ...extra,
  }
  return { ...base, hash: itemHash(base) }
}

function link(id: string, key: string | null, extra: Partial<CalendarLink> = {}): CalendarLink {
  return {
    id,
    google_event_id: `g-${id}`,
    item_key: key,
    kind: 'block',
    pushed_hash: null,
    pushed_start: null,
    etag: '"1"',
    state: 'ok',
    ...extra,
  }
}

describe('itemHash', () => {
  it('changes with the time and stays the same for the same item', () => {
    const a = item('block:a', '2026-11-02T09:00:00.000Z')
    expect(item('block:a', '2026-11-02T09:00:00.000Z').hash).toBe(a.hash)
    expect(item('block:a', '2026-11-02T10:00:00.000Z').hash).not.toBe(a.hash)
  })
})

describe('reconcile', () => {
  it('leaves pushed items, patches changed ones, inserts new ones and removes gone ones', () => {
    const same = item('exam:e1', '2026-12-01T00:00:00.000Z', { kind: 'exam', all_day: true })
    const moved = item('deadline:d1', '2026-11-20T22:59:00.000Z', { kind: 'deadline' })
    const fresh = item('class:c1:2026-11-03', '2026-11-03T08:00:00.000Z', { kind: 'class' })
    const r = reconcile(
      [same, moved, fresh],
      [
        link('1', same.key, { kind: 'exam', pushed_hash: same.hash }),
        link('2', moved.key, { kind: 'deadline', pushed_hash: 'old' }),
        link('3', 'exam:gone', { kind: 'exam', pushed_hash: 'x' }),
      ],
    )
    expect(r.patch.map((p) => p.item.key)).toEqual([moved.key])
    expect(r.insert.map((i) => i.key)).toEqual([fresh.key])
    expect(r.remove.map((x) => x.link.id)).toEqual(['3'])
  })

  it('reuses a replaced block event for the new block on the same day', () => {
    const next = item('block:new', '2026-11-02T10:00:00.000Z')
    const r = reconcile(
      [next],
      [
        link('far', 'block:old-far', { pushed_start: '2026-11-05T10:00:00.000Z' }),
        link('near', 'block:old-near', { pushed_start: '2026-11-02T09:00:00.000Z' }),
      ],
    )
    expect(r.insert).toEqual([])
    expect(r.patch).toHaveLength(1)
    expect(r.patch[0]!.link.id).toBe('near')
    expect(r.remove.map((x) => x.link.id)).toEqual(['far'])
  })

  it('does not bring back an event deleted in Google until the item changes', () => {
    const block = item('block:b', '2026-11-02T09:00:00.000Z')
    const deleted = link('1', block.key, { pushed_hash: block.hash, state: 'deleted' })
    expect(reconcile([block], [deleted])).toEqual({ patch: [], insert: [], remove: [] })
    const later = item('block:b', '2026-11-03T09:00:00.000Z')
    expect(reconcile([later], [deleted]).insert.map((i) => i.key)).toEqual([block.key])
    // Gone from Hoot too: the link goes without a Google call.
    expect(reconcile([], [deleted]).remove).toEqual([{ link: deleted, remote: false }])
  })
})

describe('toEventBody', () => {
  it('puts the start link first, keys the event and turns off Google reminders for blocks', () => {
    const block = item('block:b1', '2026-11-02T09:00:00.000Z', { description: 'Poglavlje 3' })
    const body = toEventBody(block, 'https://hoot.app', 'Europe/Sarajevo')
    expect(body.description).toBe('▶ https://hoot.app/?block=b1\n\nPoglavlje 3')
    expect(body.source).toEqual({ title: 'Hoot', url: 'https://hoot.app/?block=b1' })
    expect(body.extendedProperties?.private[HOOT_KEY]).toBe('block:b1')
    expect(body.reminders).toEqual({ useDefault: false, overrides: [] })
    expect(body.start).toEqual({ dateTime: block.starts_at, timeZone: 'Europe/Sarajevo' })
  })

  it('writes all-day items as dates', () => {
    const exam = item('exam:e', '2026-12-01T00:00:00.000Z', {
      kind: 'exam',
      all_day: true,
      ends_at: '2026-12-02T00:00:00.000Z',
    })
    const body = toEventBody(exam, null, 'Europe/Sarajevo')
    expect(body.start).toEqual({ date: '2026-12-01' })
    expect(body.end).toEqual({ date: '2026-12-02' })
    expect(body.source).toBeUndefined()
  })
})

describe('nearestColorId', () => {
  it('maps subject colors to Google colors', () => {
    expect(nearestColorId('#2563EB')).toBe('9')
    expect(nearestColorId('#d50000')).toBe('11')
    expect(nearestColorId(null)).toBeUndefined()
  })
})

describe('blockTimesFromEvent', () => {
  const boundary = { timeZone: 'Europe/Sarajevo', dayStartMin: 240 }

  it('reads a moved block as local date and wall-clock minutes', () => {
    expect(
      blockTimesFromEvent(
        {
          id: 'x',
          start: { dateTime: '2026-11-02T10:30:00+01:00' },
          end: { dateTime: '2026-11-02T11:15:00+01:00' },
        },
        boundary,
      ),
    ).toEqual({
      on_date: '2026-11-02',
      start_min: 630,
      planned_start: '2026-11-02T09:30:00.000Z',
      planned_minutes: 45,
    })
  })

  it('puts a block after midnight on the day before the boundary', () => {
    const times = blockTimesFromEvent(
      {
        id: 'x',
        start: { dateTime: '2026-11-03T01:00:00+01:00' },
        end: { dateTime: '2026-11-03T02:00:00+01:00' },
      },
      boundary,
    )
    expect(times?.on_date).toBe('2026-11-02')
    expect(times?.start_min).toBe(1500)
  })

  it('ignores all-day and too short events', () => {
    expect(blockTimesFromEvent({ id: 'x', start: { date: '2026-11-02' } }, boundary)).toBeNull()
    expect(
      blockTimesFromEvent(
        {
          id: 'x',
          start: { dateTime: '2026-11-02T10:00:00Z' },
          end: { dateTime: '2026-11-02T10:02:00Z' },
        },
        boundary,
      ),
    ).toBeNull()
  })
})

describe('toBusyRow', () => {
  it('keeps busy events and drops free and cancelled ones', () => {
    const timed = toBusyRow({
      id: 'e1',
      summary: 'Sastanak',
      start: { dateTime: '2026-11-02T10:00:00Z' },
      end: { dateTime: '2026-11-02T11:00:00Z' },
    })
    expect(timed?.allDay).toBe(false)
    expect(timed?.title).toBe('Sastanak')
    const allDay = toBusyRow({
      id: 'e2',
      start: { date: '2026-11-02' },
      end: { date: '2026-11-03' },
    })
    expect(allDay?.startsAt.toISOString()).toBe('2026-11-02T00:00:00.000Z')
    expect(allDay?.allDay).toBe(true)
    expect(toBusyRow({ id: 'e3', status: 'cancelled' })).toBeNull()
    expect(
      toBusyRow({
        id: 'e4',
        transparency: 'transparent',
        start: { dateTime: '2026-11-02T10:00:00Z' },
        end: { dateTime: '2026-11-02T11:00:00Z' },
      }),
    ).toBeNull()
  })
})

describe('OAuth state', () => {
  it('verifies a signed state and rejects tampering and expiry', async () => {
    const state = { userId: 'u1', origin: 'https://hoot.app', exp: Date.now() + 60_000 }
    const signed = await signState(state, 'secret')
    expect(await verifyState(signed, 'secret')).toEqual(state)
    expect(await verifyState(signed, 'other')).toBeNull()
    expect(await verifyState(`${signed}x`, 'secret')).toBeNull()
    expect(await verifyState(signed, 'secret', state.exp + 1)).toBeNull()
  })

  it('allows https and localhost origins only', () => {
    expect(allowedOrigin('https://dev.hoot-5ig.pages.dev')).toBe(true)
    expect(allowedOrigin('http://localhost:5173')).toBe(true)
    expect(allowedOrigin('http://evil.example')).toBe(false)
    expect(allowedOrigin('https://hoot.app/path')).toBe(false)
  })

  it('allows only paths inside the app', () => {
    expect(allowedPath('/onboarding')).toBe(true)
    expect(allowedPath('/settings/feeds')).toBe(true)
    expect(allowedPath('//evil.example')).toBe(false)
    expect(allowedPath('https://evil.example')).toBe(false)
    expect(allowedPath('/a?b=c')).toBe(false)
  })
})

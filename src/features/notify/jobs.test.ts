import { describe, expect, it } from 'vitest'
import { blockJobs, diffJobs, isIos, isQuiet, keyBytes, type SavedJob } from './jobs'

const NOW = new Date('2026-10-23T08:00:00Z')
const block = (id: string, on: string, start: string | null, status = 'planned') => ({
  id,
  on_date: on,
  status,
  planned_start: start,
})

describe('diffJobs', () => {
  const saved = (ref: string, at: string, extra: Partial<SavedJob> = {}): SavedJob => ({
    id: `id-${ref}`,
    kind: 'first_block',
    ref,
    send_at: at,
    title: 't',
    body: 'b',
    sent_at: null,
    ...extra,
  })
  const want = (ref: string, at: string) => ({
    kind: 'first_block' as const,
    ref,
    send_at: at,
    title: 't',
    body: 'b',
    url: '/',
  })

  it('upserts new or moved jobs and deletes days without a block', () => {
    const d = diffJobs(
      [
        saved('2026-10-24', '2026-10-24T07:20:00+00:00'),
        saved('2026-10-25', '2026-10-25T07:20:00Z'),
        saved('2026-10-26', '2026-10-26T07:20:00Z'),
        saved('2026-10-20', '2026-10-20T07:20:00Z', { sent_at: 'x' }),
        saved('2026-10-28', '2026-10-28T07:20:00Z', { sent_at: 'x' }),
      ],
      [
        want('2026-10-28', '2026-10-28T09:00:00Z'),
        want('2026-10-24', '2026-10-24T07:20:00.000Z'),
        want('2026-10-25', '2026-10-25T08:00:00Z'),
        want('2026-10-27', '2026-10-27T07:20:00Z'),
      ],
    )
    expect(d.upsert.map((j) => j.ref)).toEqual(['2026-10-25', '2026-10-27'])
    expect(d.remove).toEqual(['id-2026-10-26'])
  })
})

describe('helpers', () => {
  it('decodes a base64url key', () => {
    expect([...keyBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })
  it('detects iOS', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isIos('Mozilla/5.0 (Linux; Android 15)', 5)).toBe(false)
  })
})

describe('blockJobs', () => {
  const actions = { start: 'Započni', skip: 'Preskoči', skippedTitle: 'P', skippedBody: 'G' }
  const b = (id: string, on: string, start: string | null, status = 'planned') => ({
    ...block(id, on, start, status),
    planned_minutes: 50,
  })
  const run = (
    blocks: ReturnType<typeof b>[],
    offsets: number[],
    quiet: (at: Date) => boolean = () => false,
  ) =>
    blockJobs(blocks, '2026-10-23', NOW, {
      offsets,
      quiet,
      text: (x, offset) => ({ title: `${x.id}:${offset ?? 'late'}`, body: 'b' }),
      url: (x) => `/?block=${x.id}`,
      actions: () => actions,
    })

  it('one job per offset and one "Kasniš" per timed planned block, only ahead', () => {
    const jobs = run(
      [
        b('a', '2026-10-23', '2026-10-23T08:20:00Z'), // 30 min before is past, 5 min before not
        b('n', '2026-10-23', null),
        b('d', '2026-10-23', '2026-10-23T10:00:00Z', 'done'),
        b('x', '2026-11-05', '2026-11-05T10:00:00Z'), // past 7 days
      ],
      [30, 5, 5],
    )
    expect(jobs.map((j) => [j.kind, j.ref, j.send_at, j.block_id, j.url])).toEqual([
      ['block_reminder', 'a:5', '2026-10-23T08:15:00.000Z', 'a', '/?block=a'],
      ['block_late', 'a', '2026-10-23T08:35:00.000Z', 'a', '/?block=a'],
    ])
    expect(jobs[0]).toMatchObject({ title: 'a:5', actions })
  })

  it('no offsets: no reminders and no "Kasniš"; quiet hours drop a job', () => {
    expect(run([b('a', '2026-10-24', '2026-10-24T09:00:00Z')], [])).toEqual([])
    const quiet = (at: Date) => at.getUTCHours() < 8
    expect(
      run([b('a', '2026-10-24', '2026-10-24T08:10:00Z')], [60, 5], quiet).map((j) => j.ref),
    ).toEqual(['a:5', 'a'])
  })
})

describe('isQuiet', () => {
  const tz = 'Europe/Sarajevo'
  it('between going to bed and getting up, weekday or weekend', () => {
    const sleep = [23 * 60, 24 * 60 + 60]
    const wake = [7 * 60, 9 * 60]
    // Friday 23 Oct 2026 (CEST, UTC+2)
    expect(isQuiet(new Date('2026-10-23T21:30:00Z'), tz, sleep, wake)).toBe(true) // 23:30
    expect(isQuiet(new Date('2026-10-23T04:30:00Z'), tz, sleep, wake)).toBe(true) // 06:30
    expect(isQuiet(new Date('2026-10-23T05:30:00Z'), tz, sleep, wake)).toBe(false) // 07:30
    // Saturday: up at 09:00, to bed at 01:00
    expect(isQuiet(new Date('2026-10-24T06:30:00Z'), tz, sleep, wake)).toBe(true) // 08:30
    expect(isQuiet(new Date('2026-10-24T21:30:00Z'), tz, sleep, wake)).toBe(false) // 23:30
    expect(isQuiet(new Date('2026-10-24T05:30:00Z'), tz, null, wake)).toBe(false)
  })
})

describe('diffJobs over several kinds', () => {
  it('matches by kind and ref, so a reminder and "Kasniš" of one block are separate', () => {
    const saved: SavedJob[] = [
      {
        id: '1',
        kind: 'block_late',
        ref: 'a',
        send_at: '2026-10-23T09:15:00Z',
        title: 't',
        body: 'b',
        sent_at: null,
      },
      {
        id: '2',
        kind: 'first_block',
        ref: '2026-10-24',
        send_at: '2026-10-24T07:00:00Z',
        title: 't',
        body: 'b',
        sent_at: null,
      },
    ]
    const wanted = [
      {
        kind: 'block_late' as const,
        ref: 'a',
        send_at: '2026-10-23T09:15:00Z',
        title: 't',
        body: 'b',
        url: null,
      },
      {
        kind: 'block_reminder' as const,
        ref: 'a',
        send_at: '2026-10-23T08:30:00Z',
        title: 't',
        body: 'b',
        url: null,
      },
    ]
    const { upsert, remove } = diffJobs(saved, wanted, [
      'first_block',
      'block_reminder',
      'block_late',
    ])
    expect(upsert.map((j) => j.kind)).toEqual(['block_reminder'])
    expect(remove).toEqual(['2'])
  })
})

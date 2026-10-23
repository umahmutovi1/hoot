import { describe, expect, it } from 'vitest'
import { diffJobs, firstBlockJobs, isIos, keyBytes, type SavedJob } from './jobs'

const NOW = new Date('2026-10-23T08:00:00Z')
const block = (id: string, on: string, start: string | null, status = 'planned') => ({
  id,
  on_date: on,
  status,
  planned_start: start,
})
const text = (b: { id: string }) => ({ title: `t-${b.id}`, body: 'b' })

describe('firstBlockJobs', () => {
  it('one job per day for the earliest planned block, 10 min before, only ahead', () => {
    const jobs = firstBlockJobs(
      [
        block('a', '2026-10-23', '2026-10-23T07:00:00Z'), // passed
        block('b', '2026-10-24', '2026-10-24T09:00:00Z'),
        block('c', '2026-10-24', '2026-10-24T07:30:00Z'),
        block('d', '2026-10-25', null),
        block('e', '2026-10-26', '2026-10-26T07:00:00Z', 'done'),
        block('f', '2026-11-05', '2026-11-05T07:00:00Z'), // past 7 days
      ],
      '2026-10-23',
      NOW,
      text,
    )
    expect(jobs).toEqual([
      {
        kind: 'first_block',
        ref: '2026-10-24',
        send_at: '2026-10-24T07:20:00.000Z',
        url: '/',
        title: 't-c',
        body: 'b',
      },
    ])
  })
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

import { describe, expect, it } from 'vitest'
import {
  blockJobLive,
  hashToken,
  isGone,
  newActionToken,
  payloadOf,
  splitDue,
  type DueJob,
  type LiveBlock,
} from './push'

const job = (id: string, at: string): DueJob => ({
  id,
  user_id: 'u',
  kind: 'first_block',
  ref: '2026-10-23',
  title: 'Za 10 min: Signali',
  body: '4 Fourierova · 09:00',
  url: '/',
  send_at: at,
})

describe('notify rules', () => {
  const now = new Date('2026-10-23T08:00:00Z')
  it('sends due jobs, drops the ones more than 30 min late, keeps future ones', () => {
    const { send, stale } = splitDue(
      [
        job('due', '2026-10-23T07:59:00Z'),
        job('edge', '2026-10-23T07:30:00Z'),
        job('late', '2026-10-23T07:29:00Z'),
        job('future', '2026-10-23T08:01:00Z'),
      ],
      now,
    )
    expect(send.map((j) => j.id)).toEqual(['due', 'edge'])
    expect(stale.map((j) => j.id)).toEqual(['late'])
  })
  it('payload and gone subscriptions', () => {
    expect(JSON.parse(payloadOf(job('a', '')))).toEqual({
      title: 'Za 10 min: Signali',
      body: '4 Fourierova · 09:00',
      url: '/',
      tag: 'first_block:2026-10-23',
    })
    expect([404, 410, 429, undefined].map(isGone)).toEqual([true, true, false, false])
  })
})

describe('block reminders', () => {
  const reminder: DueJob = {
    id: 'j',
    user_id: 'u',
    kind: 'block_reminder',
    ref: 'b2:30',
    title: 'Za 30 min: Signali',
    body: 'Fourier · 50 min',
    url: '/?block=b2',
    send_at: '2026-10-23T09:30:00Z',
    block_id: 'b2',
    actions: { start: 'Započni', skip: 'Preskoči', skippedTitle: 'Preskočeno', skippedBody: 'Ok' },
  }
  const blk = (id: string, start: string, extra: Partial<LiveBlock> = {}): LiveBlock => ({
    id,
    on_date: '2026-10-23',
    planned_start: start,
    planned_minutes: 50,
    status: 'planned',
    skip_requested_at: null,
    ...extra,
  })
  const blocks = [blk('b1', '2026-10-23T08:50:00Z'), blk('b2', '2026-10-23T10:00:00Z')]

  it('payload: Započni / Preskoči with the token, one tag per block', () => {
    const p = JSON.parse(payloadOf(reminder, { token: 'tok', endpoint: 'https://x/push-action' }))
    expect(p.tag).toBe('block:b2')
    expect(p.actions).toEqual([
      { action: 'start', title: 'Započni' },
      { action: 'skip', title: 'Preskoči' },
    ])
    expect(p.skip).toEqual({
      endpoint: 'https://x/push-action',
      token: 'tok',
      title: 'Preskočeno',
      body: 'Ok',
    })
    // Without a token (or for other kinds) no buttons.
    expect(JSON.parse(payloadOf(reminder)).actions).toBeUndefined()
  })

  it('a token is random base64url and only its hash is kept', async () => {
    const a = newActionToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(newActionToken()).not.toBe(a)
    expect(await hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('sent while the block is still ahead and not started', () => {
    expect(blockJobLive(reminder, blocks, [])).toBe(true)
    expect(blockJobLive(reminder, [blocks[0]!], [])).toBe(false)
    expect(blockJobLive(reminder, [blocks[0]!, { ...blocks[1]!, status: 'skipped' }], [])).toBe(
      false,
    )
    expect(
      blockJobLive(reminder, [blocks[0]!, { ...blocks[1]!, skip_requested_at: 'x' }], []),
    ).toBe(false)
    expect(blockJobLive(reminder, blocks, [{ block_id: 'b2', ended_at: null }])).toBe(false)
  })

  it('a reminder waits out the block before it only while that one is being studied', () => {
    expect(blockJobLive(reminder, blocks, [{ block_id: 'b1', ended_at: null }])).toBe(false)
    expect(blockJobLive(reminder, blocks, [{ block_id: 'b1', ended_at: 'x' }])).toBe(true)
    // "Kasniš" does not care about the block before.
    const late = { ...reminder, kind: 'block_late', ref: 'b2' }
    expect(blockJobLive(late, blocks, [{ block_id: 'b1', ended_at: null }])).toBe(true)
  })
})

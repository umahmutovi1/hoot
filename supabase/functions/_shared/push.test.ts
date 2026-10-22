import { describe, expect, it } from 'vitest'
import { isGone, payloadOf, splitDue, type DueJob } from './push'

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

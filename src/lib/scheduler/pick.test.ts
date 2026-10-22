import { describe, expect, it } from 'vitest'
import { pickForTime, type PickBlock, type PickInput } from '.'

const TODAY = '2026-10-22'
const block = (id: string, over: Partial<PickBlock> = {}): PickBlock => ({
  id,
  subjectId: 'a',
  kind: 'learn',
  onDate: TODAY,
  startMin: 540,
  minutes: 60,
  daysToGoal: 10,
  units: [
    { unitId: `${id}-1`, minutes: 40 },
    { unitId: `${id}-2`, minutes: 20 },
  ],
  ...over,
})
const input = (over: Partial<PickInput> = {}): PickInput => ({
  minutes: 30,
  today: TODAY,
  todayBlocks: [],
  dueReviews: [],
  laterBlocks: [],
  ...over,
})

describe('pickForTime', () => {
  it('takes a check due today with the lowest strength first', () => {
    const r = pickForTime(
      input({
        todayBlocks: [block('b1')],
        dueReviews: [
          { unitId: 'u1', subjectId: 'a', minutes: 10, retrievability: 0.8, nextReviewOn: TODAY },
          { unitId: 'u2', subjectId: 'b', minutes: 10, retrievability: 0.6, nextReviewOn: TODAY },
          { unitId: 'u3', subjectId: 'b', minutes: 15, retrievability: 0.7, nextReviewOn: TODAY },
        ],
      }),
    )
    expect(r).toMatchObject({ from: 'review', subjectId: 'b', kind: 'review', minutes: 25 })
    expect(r!.units.map((u) => u.unitId)).toEqual(['u2', 'u3'])
  })

  it('then the most urgent block of today, trimmed to the time and tied to that block', () => {
    const r = pickForTime(
      input({
        todayBlocks: [
          block('b1', { daysToGoal: 20 }),
          block('b2', { daysToGoal: 5, startMin: 900 }),
        ],
      }),
    )
    expect(r).toMatchObject({ from: 'today', blockId: 'b2', minutes: 30 })
    expect(r!.units).toEqual([{ unitId: 'b2-1', minutes: 30 }])
  })

  it('then the next block, without tying the session to it', () => {
    const r = pickForTime(
      input({
        minutes: 60,
        laterBlocks: [block('c2', { onDate: '2026-10-24' }), block('c1', { onDate: '2026-10-23' })],
      }),
    )
    expect(r).toMatchObject({ from: 'next', blockId: null, minutes: 60 })
    expect(r!.units.map((u) => u.unitId)).toEqual(['c1-1', 'c1-2'])
  })

  it('is null without anything to do', () => {
    expect(pickForTime(input())).toBeNull()
    expect(pickForTime(input({ minutes: 0, todayBlocks: [block('b')] }))).toBeNull()
  })
})

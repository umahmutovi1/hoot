import { describe, expect, it } from 'vitest'
import { completionExamples, type ExampleBlock } from './examples'

const TODAY = '2026-10-29'
const block = (id: string, over: Partial<ExampleBlock> = {}): ExampleBlock => ({
  id,
  subjectId: 's',
  onDate: '2026-10-27',
  kind: 'learn',
  status: 'missed',
  origin: 'ai',
  planStartMin: 600,
  plannedStart: '2026-10-27T09:00:00Z',
  dayLoadMin: 120,
  daysToGoal: 5,
  demand: 1.3,
  ...over,
})

describe('completionExamples', () => {
  it('labels AI blocks with a plan start, as block_examples() in ml/', () => {
    const out = completionExamples(
      [
        block('a', { status: 'done' }),
        block('b', { planStartMin: 1200, plannedStart: '2026-10-27T19:00:00Z' }),
        block('c', { planStartMin: null }), // saved before Stage 11a: no features
        block('d', { onDate: TODAY, status: 'planned' }), // open: no label yet
        block('m', { origin: 'user' }), // manual: not a plan example
      ],
      [
        {
          subjectId: 's',
          onDate: '2026-10-28',
          kind: 'learn',
          startMin: 960,
          dayLoadMin: 100,
          daysToGoal: 4,
          demand: 1,
        },
      ],
      [],
      TODAY,
    )
    expect(out.map((e) => [e.label, e.part])).toEqual([
      ['done', 'morning'],
      ['unconfirmed', 'evening'],
      ['skipped', 'afternoon'],
    ])
  })

  it('prevLate: the block before it that day started more than 5 min late', () => {
    const out = completionExamples(
      [
        block('a', { status: 'done' }),
        block('b', { planStartMin: 700, plannedStart: '2026-10-27T10:40:00Z' }),
        block('c', { planStartMin: 800, plannedStart: '2026-10-27T12:20:00Z' }),
        block('d', { onDate: '2026-10-28', plannedStart: '2026-10-28T09:00:00Z' }),
      ],
      [],
      [
        { blockId: 'a', startedAt: '2026-10-27T09:40:00Z' },
        { blockId: 'a', startedAt: '2026-10-27T09:12:00Z' }, // the first session counts
        { blockId: 'c', startedAt: '2026-10-27T12:21:00Z' },
      ],
      TODAY,
    )
    expect(out.map((e) => e.prevLate)).toEqual([false, true, false, false])
    // A session makes a block done (c).
    expect(out.map((e) => e.label)).toEqual(['done', 'unconfirmed', 'done', 'unconfirmed'])
  })
})

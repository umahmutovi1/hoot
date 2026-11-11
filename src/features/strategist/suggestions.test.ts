import { describe, expect, it } from 'vitest'
import type { PlanBlockRow } from '@/features/plan/state'
import type { Feedback } from './feedback'
import {
  collectSuggestions,
  confirmTargets,
  movedWork,
  stateOf,
  summaryOf,
  type ShownSuggestion,
  type Suggestion,
} from './suggestions'

const today = '2026-11-11'
const ask = (id: string): Suggestion => ({
  id,
  kind: 'ask',
  from: 'strategist',
  subjectId: null,
  candidate: { id, rule: 'deficit', action: { kind: 'change_buffer', days: 2 }, effect: null },
  reason: null,
})
const done = (id: string): Suggestion => ({
  id,
  kind: 'done',
  from: 'replan',
  subjectId: 's',
  moved: {
    missedId: id,
    subjectId: 's',
    goalId: 'g',
    unitIds: ['u'],
    minutes: 30,
    on: '2026-11-13',
    startMin: 1020,
  },
})
let seq = 0
const row = (
  id: string,
  status: Feedback['status'],
  created = '2026-11-10',
  payload: Record<string, unknown> = {},
): Feedback => ({
  id: `r${++seq}`,
  user_id: 'u',
  insight_id: id,
  candidate_id: null,
  status,
  payload: payload as Feedback['payload'],
  created_at: `${created}T10:00:00.${String(seq).padStart(3, '0')}Z`,
  updated_at: `${created}T10:00:00Z`,
})

describe('stateOf', () => {
  it('reads the latest decision', () => {
    expect(stateOf([], ask('a'), today)).toBe('pending')
    expect(stateOf([row('a', 'accepted')], ask('a'), today)).toBe('approved')
    expect(stateOf([row('a', 'rejected')], ask('a'), today)).toBe('declined')
    expect(stateOf([row('d', 'rejected')], done('d'), today)).toBe('undone')
    expect(stateOf([row('a', 'not_useful')], ask('a'), today)).toBeNull()
  })

  it('opens the suggestion again after "Vrati odluku" or after 14 days', () => {
    const rows = [row('a', 'accepted'), row('a', 'rejected', '2026-11-10', { reverted: true })]
    expect(stateOf(rows, ask('a'), today)).toBe('pending')
    expect(stateOf([row('a', 'accepted', '2026-10-20')], ask('a'), today)).toBe('pending')
  })
})

describe('collectSuggestions', () => {
  it('keeps a decided suggestion the rules no longer offer', () => {
    const rows = [row('gone', 'accepted', '2026-11-09', { suggestion: ask('gone') })]
    const list = collectSuggestions([ask('a')], rows, today)
    expect(list.map((s) => [s.suggestion.id, s.state])).toEqual([
      ['a', 'pending'],
      ['gone', 'approved'],
    ])
  })

  it('shows a live suggestion once and drops old decisions and "not useful"', () => {
    const rows = [
      row('a', 'accepted', '2026-11-09', { suggestion: ask('a') }),
      row('old', 'accepted', '2026-10-01', { suggestion: ask('old') }),
      row('x', 'not_useful', '2026-11-09', { suggestion: ask('x') }),
    ]
    expect(collectSuggestions([ask('a')], rows, today).map((s) => s.suggestion.id)).toEqual(['a'])
  })
})

describe('confirmTargets', () => {
  const shown: ShownSuggestion[] = [
    { suggestion: ask('a'), state: 'pending' },
    { suggestion: done('d'), state: 'pending' },
    { suggestion: ask('b'), state: 'pending' },
    { suggestion: ask('c'), state: 'approved' },
  ]

  it('approves open asks and confirms what Hoot already did', () => {
    expect(confirmTargets(shown, 3).map((s) => s.suggestion.id)).toEqual(['a', 'd', 'b'])
  })

  it('stays within the weekly limit of accepted actions, done work is not counted', () => {
    expect(confirmTargets(shown, 1).map((s) => s.suggestion.id)).toEqual(['a', 'd'])
    expect(summaryOf(shown)).toEqual({ pending: 3, applied: 1 })
  })
})

describe('movedWork', () => {
  const block = (patch: Partial<PlanBlockRow>): PlanBlockRow =>
    ({
      id: 'b',
      origin: 'ai',
      assessment_id: 'g',
      subject_id: 's',
      on_date: '2026-11-09',
      start_min: 600,
      planned_minutes: 30,
      status: 'missed',
      plan_block_units: [{ unit_id: 'u1' }, { unit_id: 'u2' }],
      ...patch,
    }) as PlanBlockRow

  it('finds where the replan placed a missed block', () => {
    const blocks = [
      block({}),
      block({
        id: 'late',
        on_date: '2026-11-14',
        status: 'planned',
        plan_block_units: [{ unit_id: 'u1' }] as PlanBlockRow['plan_block_units'],
      }),
      block({
        id: 'next',
        on_date: '2026-11-12',
        start_min: 1020,
        status: 'planned',
        plan_block_units: [
          { unit_id: 'u2' },
          { unit_id: 'u9' },
        ] as PlanBlockRow['plan_block_units'],
      }),
    ]
    expect(movedWork(blocks, '2026-11-04', today)).toEqual([
      {
        missedId: 'b',
        subjectId: 's',
        goalId: 'g',
        unitIds: ['u2'],
        minutes: 30,
        on: '2026-11-12',
        startMin: 1020,
      },
    ])
  })

  it('skips manual blocks, blocks without an exam and work not placed again', () => {
    expect(movedWork([block({ origin: 'user' })], '2026-11-04', today)).toEqual([])
    expect(movedWork([block({ assessment_id: null })], '2026-11-04', today)).toEqual([])
    expect(movedWork([block({})], '2026-11-04', today)).toEqual([])
  })
})

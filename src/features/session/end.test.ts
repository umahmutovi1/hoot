import { describe, expect, it } from 'vitest'
import type { Op } from '@/lib/sync'
import {
  defaultLevel,
  readAfter,
  endLevels,
  planEnd,
  reallocate,
  savedRanges,
  summarize,
  type EndSource,
} from './end'
import type { SegmentRow, SessionRow } from './model'

const T0 = Date.parse('2026-10-21T08:00:00Z')
const iso = (min: number) => new Date(T0 + min * 60_000).toISOString()

const session: SessionRow = {
  id: 'sess',
  subject_id: 'subj',
  block_id: null,
  mode: 'reading',
  timer_mode: 'pomodoro25',
  origin: 'timer',
  planned_minutes: null,
  started_at: iso(0),
  ended_at: iso(50),
  focus: null,
  focus_reasons: null,
  distractions: 0,
  break_ends_at: null,
  reflection: null,
  app_leaves: 0,
  app_away_sec: 0,
  updated_at: iso(50),
}

const seg = (id: string, unit: string | null, from: number, to: number): SegmentRow => ({
  id,
  session_id: 'sess',
  unit_id: unit,
  started_at: iso(from),
  ended_at: iso(to),
})

const source = (over: Partial<EndSource> = {}): EndSource => ({
  id: 'src',
  measure: 'pages',
  rate: 4,
  units: [
    {
      id: 'a',
      kind: 'chapter',
      amount: 10,
      level: 0,
      difficulty: 3,
      completedAt: null,
      nextReviewOn: null,
      lastReviewAt: null,
    },
    {
      id: 'b',
      kind: 'chapter',
      amount: 10,
      level: 0,
      difficulty: 3,
      completedAt: null,
      nextReviewOn: null,
      lastReviewAt: null,
    },
    {
      id: 'c',
      kind: 'chapter',
      amount: 10,
      level: 1,
      difficulty: 3,
      completedAt: iso(-999),
      nextReviewOn: null,
      lastReviewAt: null,
    },
  ],
  ...over,
})

const answers = {
  ranges: [{ sourceId: 'src', from: { unitId: 'a', offset: 0 }, to: { unitId: 'b', offset: 5 } }],
  ratings: {},
  levels: {},
  focus: 2,
  focusReasons: ['tired'],
  reflection: '  ',
}

function opOf(ops: Op[], table: string, kind: Op['kind'] = 'upsert') {
  return ops.filter((o) => o.table === table && o.kind === kind)
}

describe('planEnd', () => {
  // 20 min on a, pause, 25 min on a (read through half of b)
  const segments = [seg('1', 'a', 0, 20), seg('2', 'a', 25, 50)]

  it('splits the minutes over the covered units by estimated time', () => {
    const { minutes } = planEnd(session, segments, [source()], answers)
    expect(minutes.get('a')).toBeCloseTo(30)
    expect(minutes.get('b')).toBeCloseTo(15)
  })

  it('writes session_units with amount, levels and the chapter read to its end as read', () => {
    const { ops } = planEnd(session, segments, [source()], answers)
    const [su] = opOf(ops, 'session_units')
    expect(su?.kind === 'upsert' && su.rows).toEqual([
      expect.objectContaining({ unit_id: 'a', amount_done: 10, level_before: 0, level_after: 1 }),
      expect.objectContaining({ unit_id: 'b', amount_done: 5, level_before: 0, level_after: 0 }),
    ])
    const updates = opOf(ops, 'units', 'update')
    expect(updates).toHaveLength(2)
    expect(updates[0]).toMatchObject({ match: { id: 'a' }, patch: { level: 1 } })
    // Half of b is read: kept, so the next session and the plan continue there.
    expect(updates[1]).toMatchObject({ match: { id: 'b' }, patch: { read_amount: 5 } })
  })

  it('leaves speed calibration to the recompute from all sessions', () => {
    const { ops } = planEnd(session, segments, [source()], answers)
    expect(ops.some((o) => o.table === 'sources' || o.table === 'source_mode_rates')).toBe(false)
  })

  it('editing replaces the saved rows and keeps the status from before', () => {
    const saved = [
      {
        unit_id: 'a',
        minutes: 45,
        amount_done: 10,
        level_before: 0,
        level_after: 1,
        difficulty: null,
      },
    ]
    const editedSource = source()
    editedSource.units[0]!.level = 1
    const { ops } = planEnd(session, segments, [editedSource], answers, new Date(), saved)
    expect(ops[1]).toEqual({
      kind: 'delete',
      table: 'session_units',
      match: { session_id: 'sess' },
    })
    expect(opOf(ops, 'session_units')[0]).toMatchObject({
      rows: expect.arrayContaining([
        expect.objectContaining({ unit_id: 'a', level_before: 0, level_after: 1 }),
      ]),
    })
    // Only b's partial reading is written; a keeps its status.
    expect(opOf(ops, 'units', 'update')).toEqual([
      { kind: 'update', table: 'units', match: { id: 'b' }, patch: { read_amount: 5 } },
    ])
  })

  it('uses the rating for difficulty and stores it on the unit', () => {
    const { ops } = planEnd(session, segments, [source()], { ...answers, ratings: { a: 5 } })
    expect(opOf(ops, 'units', 'update')[0]).toMatchObject({
      patch: { level: 1, user_difficulty: 5 },
    })
  })

  it('keeps reasons for low focus only with focus 1', () => {
    const low = planEnd(session, segments, [source()], { ...answers, focus: 1 })
    expect(opOf(low.ops, 'study_sessions')[0]).toMatchObject({
      rows: [{ focus: 1, focus_reasons: ['tired'] }],
    })
  })

  it('keeps focus, drops an empty reflection, never calibrates without progress', () => {
    const { ops } = planEnd(session, segments, [source()], { ...answers, ranges: [] })
    const [s] = opOf(ops, 'study_sessions')
    expect(s).toMatchObject({ rows: [{ focus: 2, focus_reasons: null, reflection: null }] })
    // a was studied without reported progress: it keeps its minutes
    expect(opOf(ops, 'session_units')[0]).toMatchObject({
      rows: [{ unit_id: 'a', minutes: 45, amount_done: 0 }],
    })
  })

  it('takes a user-picked status over the default', () => {
    const { ops } = planEnd(session, segments, [source()], { ...answers, levels: { a: 2, b: 1 } })
    const updates = opOf(ops, 'units', 'update')
    expect(updates.map((u) => u.kind === 'update' && u.patch.level)).toEqual([2, 1])
  })
})

describe('planEnd: recall gate', () => {
  const whole = [seg('1', 'a', 0, 50)]
  const readAll = {
    ...answers,
    ranges: [
      { sourceId: 'src', from: { unitId: 'a', offset: 0 }, to: { unitId: 'c', offset: 10 } },
    ],
  }

  it('offers the gate for units read to their end and schedules their check in 2 days', () => {
    const plan = planEnd(session, whole, [source()], readAll, new Date(), [], '2026-10-21')
    expect(plan.gate).toEqual(['a', 'b', 'c'])
    const patches = Object.fromEntries(
      opOf(plan.ops, 'units', 'update').map((u) => [
        u.kind === 'update' && u.match.id,
        u.kind === 'update' && u.patch,
      ]),
    )
    expect(patches.a).toMatchObject({ level: 1, next_review_on: '2026-10-23' })
    expect(patches.c).toMatchObject({ next_review_on: '2026-10-23' })
  })

  it('half-read units, units tested during the session and edits get no gate or check', () => {
    const tested = source({
      units: source().units.map((u) => (u.id === 'b' ? { ...u, lastReviewAt: iso(30) } : u)),
    })
    const plan = planEnd(session, whole, [tested], answers, new Date(), [], '2026-10-21')
    expect(plan.gate).toEqual(['a'])
    const edit = planEnd(session, whole, [source()], readAll, new Date(), [], null)
    expect(
      opOf(edit.ops, 'units', 'update').some(
        (u) => u.kind === 'update' && 'next_review_on' in u.patch,
      ),
    ).toBe(false)
  })

  it('"Samo spasi" records the skipped gate', () => {
    const plan = planEnd(
      session,
      whole,
      [source()],
      { ...readAll, skipGate: true },
      new Date(),
      [],
      '2026-10-21',
    )
    const rows = opOf(plan.ops, 'session_units')[0]!
    expect(rows.kind === 'upsert' && rows.rows.map((r) => r.recall_skipped)).toEqual([
      true,
      true,
      true,
    ])
  })
})

describe('endLevels', () => {
  it('offers "Razumijem"/"Ponovljeno" only to keep them', () => {
    expect(endLevels(1)).toEqual([0, 1])
    expect(endLevels(2)).toEqual([0, 1, 2])
    expect(endLevels(3)).toEqual([0, 1, 3])
  })
})

describe('defaultLevel', () => {
  it('only an unstarted chapter read to its end becomes read', () => {
    const done = { unitId: 'x', amountDone: 3, complete: true, end: 9 }
    const chapter = { kind: 'chapter' as const, amount: 9 }
    expect(defaultLevel({ ...chapter, level: 0 }, done)).toBe(1)
    expect(defaultLevel({ ...chapter, level: 2 }, done)).toBe(2)
    expect(defaultLevel({ ...chapter, level: 0 }, { ...done, complete: false, end: 3 })).toBe(0)
    expect(defaultLevel({ kind: 'question', level: 0, amount: 1 }, done)).toBe(0)
  })

  it('reading over several sessions adds up to "Pročitano"', () => {
    // Pages 1–2 earlier, now 3–9 of a 9-page unit.
    const now = { unitId: 'x', amountDone: 7, complete: true, end: 9 }
    expect(readAfter({ amount: 9, readAmount: 2 }, now)).toBe(9)
    expect(defaultLevel({ kind: 'chapter', level: 0, amount: 9, readAmount: 2 }, now)).toBe(1)
    // Pages 1–2 only: partial, still "Nije".
    const part = { unitId: 'x', amountDone: 2, complete: false, end: 2 }
    expect(readAfter({ amount: 9, readAmount: 0 }, part)).toBe(2)
    expect(defaultLevel({ kind: 'chapter', level: 0, amount: 9, readAmount: 0 }, part)).toBe(0)
    // Reading earlier pages again never lowers what was read.
    expect(readAfter({ amount: 9, readAmount: 6 }, part)).toBe(6)
  })
})

describe('summarize', () => {
  it('counts studied minutes and pauses up to the end', () => {
    expect(summarize(session, [seg('1', 'a', 0, 20), seg('2', 'a', 25, 50)], new Date())).toEqual({
      activeMin: 45,
      pauses: 1,
      pauseMin: 5,
    })
  })
})

describe('reallocate', () => {
  it('splits new times over the same covered amounts', () => {
    const saved = [
      {
        unit_id: 'a',
        minutes: 30,
        amount_done: 10,
        level_before: 0,
        level_after: 1,
        difficulty: null,
      },
      {
        unit_id: 'b',
        minutes: 15,
        amount_done: 10,
        level_before: 0,
        level_after: 1,
        difficulty: null,
      },
    ]
    const m = reallocate([seg('1', 'a', 0, 60)], [source()], saved, new Date(iso(60)))
    expect(m.get('a')).toBeCloseTo(30)
    expect(m.get('b')).toBeCloseTo(30)
  })
})

describe('savedRanges', () => {
  it('rebuilds from–to out of saved amounts', () => {
    const saved = [
      {
        unit_id: 'a',
        minutes: 1,
        amount_done: 4,
        level_before: 0,
        level_after: 1,
        difficulty: null,
      },
      {
        unit_id: 'b',
        minutes: 1,
        amount_done: 5,
        level_before: 0,
        level_after: 0,
        difficulty: null,
      },
    ]
    expect(savedRanges([source()], saved)).toEqual([
      { sourceId: 'src', from: { unitId: 'a', offset: 6 }, to: { unitId: 'b', offset: 5 } },
    ])
    expect(savedRanges([source()], [saved[1]!])).toEqual([
      { sourceId: 'src', from: { unitId: 'b', offset: 0 }, to: { unitId: 'b', offset: 5 } },
    ])
  })
})

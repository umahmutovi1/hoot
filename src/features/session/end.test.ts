import { describe, expect, it } from 'vitest'
import type { Op } from '@/lib/sync'
import { defaultLevel, planEnd, summarize, type EndSource } from './end'
import type { SegmentRow, SessionRow } from './model'

const T0 = Date.parse('2026-10-21T08:00:00Z')
const iso = (min: number) => new Date(T0 + min * 60_000).toISOString()

const session: SessionRow = {
  id: 'sess',
  subject_id: 'subj',
  block_id: null,
  mode: 'reading',
  timer_mode: 'pomodoro25',
  planned_minutes: null,
  started_at: iso(0),
  ended_at: iso(50),
  focus: null,
  reflection: null,
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
  learned: { rate: null, samples: 0 },
  measuredSessions: 0,
  pair: { rate: null, samples: 0 },
  units: [
    { id: 'a', kind: 'chapter', amount: 10, level: 0, difficulty: 3, completedAt: null },
    { id: 'b', kind: 'chapter', amount: 10, level: 0, difficulty: 3, completedAt: null },
    { id: 'c', kind: 'chapter', amount: 10, level: 1, difficulty: 3, completedAt: iso(-999) },
  ],
  ...over,
})

const answers = {
  ranges: [{ sourceId: 'src', from: { unitId: 'a', offset: 0 }, to: { unitId: 'b', offset: 5 } }],
  ratings: {},
  levels: {},
  focus: 2,
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
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ match: { id: 'a' }, patch: { level: 1 } })
  })

  it('calibrates the source and the source × mode pair', () => {
    const { ops } = planEnd(session, segments, [source()], answers)
    const [src] = opOf(ops, 'sources', 'update')
    // a: 30 min / 10 pages = 3, b: 15 / 5 = 3
    expect(src).toMatchObject({
      patch: { learned_min_per_unit: 3, learned_samples: 2, measured_sessions: 1 },
    })
    const [pair] = opOf(ops, 'source_mode_rates')
    expect(pair).toMatchObject({
      rows: [{ source_id: 'src', mode: 'reading', min_per_unit: 3, samples: 2 }],
    })
  })

  it('leaves the pair alone when it is not known (offline)', () => {
    const { ops } = planEnd(session, segments, [source({ pair: null })], answers)
    expect(opOf(ops, 'source_mode_rates')).toEqual([])
  })

  it('uses the rating for difficulty and stores it on the unit', () => {
    const { ops } = planEnd(session, segments, [source()], { ...answers, ratings: { a: 5 } })
    expect(opOf(ops, 'units', 'update')[0]).toMatchObject({
      patch: { level: 1, user_difficulty: 5 },
    })
  })

  it('keeps focus, drops an empty reflection, never calibrates without progress', () => {
    const { ops } = planEnd(session, segments, [source()], { ...answers, ranges: [] })
    const [s] = opOf(ops, 'study_sessions')
    expect(s).toMatchObject({ rows: [{ focus: 2, reflection: null }] })
    expect(opOf(ops, 'sources', 'update')).toEqual([])
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

describe('defaultLevel', () => {
  it('only an unstarted chapter read to its end becomes read', () => {
    const done = { unitId: 'x', amountDone: 3, complete: true }
    expect(defaultLevel({ kind: 'chapter', level: 0 }, done)).toBe(1)
    expect(defaultLevel({ kind: 'chapter', level: 2 }, done)).toBe(2)
    expect(defaultLevel({ kind: 'chapter', level: 0 }, { ...done, complete: false })).toBe(0)
    expect(defaultLevel({ kind: 'question', level: 0 }, done)).toBe(0)
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

import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { BUILT_IN_PRESETS } from '@/lib/session/timer'
import { slotSignals, type SlotObservation } from '@/lib/slots/signals'
import { insights, shownInsights, type InsightInput } from '.'

const TODAY = '2026-11-02'

const input = (patch: Partial<InsightInput> = {}): InsightInput => ({
  today: TODAY,
  slots: null,
  rhythm: null,
  preset: BUILT_IN_PRESETS[0]!,
  modeSpeeds: [],
  subjectEffects: [],
  postponements: [],
  calibration: [],
  weekModes: [],
  sessionEnds: [],
  exams: [],
  ...patch,
})
const kinds = (p: Partial<InsightInput>) => insights(input(p)).map((i) => i.kind)
const postpone = (subjectId: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ subjectId, onDate: addDays(TODAY, -1 - i) }))

describe('insights', () => {
  it('nothing without enough measurements', () => {
    expect(insights(input())).toEqual([])
  })

  it('late before an exam: 2 nights past 00:30 in the 7 days before it', () => {
    const exams = [{ goalId: 'e', subjectId: 's', on: addDays(TODAY, 3) }]
    const late = (d: number) => ({ onDate: addDays(TODAY, d), endMin: 24 * 60 + 45 })
    const [i] = insights(input({ exams, sessionEnds: [late(-2), late(-1), late(-1)] }))
    expect(i).toMatchObject({
      kind: 'late_before_exam',
      nights: 2,
      technique: 'sleep',
      action: { kind: 'end_by', goalId: 'e', untilMin: 23 * 60, until: addDays(TODAY, 3) },
    })
    expect(kinds({ exams, sessionEnds: [late(-1), { onDate: TODAY, endMin: 24 * 60 }] })).toEqual(
      [],
    )
  })

  it('avoidance: ≥ 3 postponements in 14 days and ≥ 2× the others, and the model agrees', () => {
    const postponements = [...postpone('a', 4), ...postpone('b', 1), ...postpone('c', 1)]
    const [i] = insights(input({ postponements }))
    expect(i).toMatchObject({
      id: 'avoidance:a',
      kind: 'avoidance',
      postponed: 4,
      othersAverage: 1,
      action: { kind: 'first_step', subjectId: 'a' },
    })
    // Below twice the others: no.
    expect(kinds({ postponements: [...postpone('a', 4), ...postpone('b', 3)] })).toEqual([])
    // The model sees no subject effect (a bad slot or a full day instead): no.
    const neutral = { subjectId: 'a', mean: -0.1, sd: 0.5, weight: 12 }
    expect(kinds({ postponements, subjectEffects: [neutral] })).toEqual([])
    const clear = { ...neutral, mean: -1.2 }
    expect(kinds({ postponements, subjectEffects: [clear] })).toEqual(['avoidance'])
  })

  it('recall share below 30% of a week with ≥ 3 h: next 2 reading blocks become questions', () => {
    const [i] = insights(
      input({
        weekModes: [
          { mode: 'reading', minutes: 200 },
          { mode: 'questions', minutes: 40 },
        ],
      }),
    )
    expect(i).toMatchObject({
      kind: 'recall_share',
      share: 0.17,
      minutes: 240,
      technique: 'self_testing',
      action: { kind: 'questions_next', blocks: 2 },
    })
    expect(kinds({ weekModes: [{ mode: 'reading', minutes: 150 }] })).toEqual([])
  })

  it('calibration: ≥ 10 pairs that overestimate by 15 p.p. or more', () => {
    const pair = (predicted: number, actual: number) => ({ subjectId: 's', predicted, actual })
    const over = Array.from({ length: 10 }, () => pair(0.8, 0.55))
    expect(insights(input({ calibration: over }))[0]).toMatchObject({
      kind: 'calibration',
      overBy: 0.25,
      pairs: 10,
      action: { kind: 'strict_recall_gate', subjectId: 's' },
    })
    expect(kinds({ calibration: over.slice(0, 9) })).toEqual([])
    expect(kinds({ calibration: Array.from({ length: 10 }, () => pair(0.6, 0.55)) })).toEqual([])
  })

  it('slots: best slot with its focus (and add_slot when clearly good), distractions', () => {
    const obs = (part: SlotObservation['part'], focus: number, leaves: number) =>
      Array.from({ length: 9 }, (_, i) => ({
        onDate: addDays(TODAY, -1 - i),
        part,
        weekend: false,
        focus,
        hard: false,
        speed: 1,
        startDelayMin: 0,
        minutes: 30,
        leaves,
      }))
    const slots = slotSignals([...obs('afternoon', 2.7, 0), ...obs('evening', 2, 3)], TODAY)
    const list = insights(input({ slots }))
    expect(list.find((i) => i.kind === 'best_slot')).toMatchObject({
      part: 'afternoon',
      focus: 2.7,
      sessions: 9,
      action: { kind: 'add_slot', weekend: false, part: 'afternoon' },
    })
    expect(list.find((i) => i.kind === 'distraction')).toMatchObject({
      part: 'evening',
      leavesPer30: 3,
    })
  })

  it('first break and the preset card; speed per mode', () => {
    const rhythm = { sessions: 10, firstBreakMin: 35, pauseMin: 10, earlyShare: 0 }
    expect(insights(input({ rhythm }))[0]).toMatchObject({
      kind: 'first_break',
      aboutMin: 35,
      action: { kind: 'set_preset', workMin: 35, breakMin: 10 },
    })
    const [s] = insights(
      input({
        modeSpeeds: [
          { mode: 'questions', ratio: 0.7, sessions: 8 },
          { mode: 'reading', ratio: 1.1, sessions: 20 },
        ],
      }),
    )
    expect(s).toMatchObject({ kind: 'speed', mode: 'questions', ratio: 0.7 })
  })

  it('ordered by the effect on the nearest exam; "nije korisno" hides one', () => {
    const list = insights(
      input({
        postponements: [...postpone('a', 4), ...postpone('b', 1)],
        weekModes: [{ mode: 'reading', minutes: 300 }],
        exams: [{ goalId: 'e', subjectId: 'a', on: addDays(TODAY, 2) }],
        sessionEnds: [-1, -2].map((d) => ({ onDate: addDays(TODAY, d), endMin: 1500 })),
      }),
    )
    expect(list.map((i) => i.kind)).toEqual(['late_before_exam', 'avoidance', 'recall_share'])
    expect(shownInsights(list, new Set(['avoidance:a'])).map((i) => i.kind)).toEqual([
      'late_before_exam',
      'recall_share',
    ])
  })
})

it('Sprint 17 recall share keeps the same dismissal key across days and weeks', () => {
  const weekModes = [{ mode: 'reading' as const, minutes: 240 }]
  const a = insights(input({ weekModes })).find((i) => i.kind === 'recall_share')!
  const b = insights(input({ weekModes, today: addDays(TODAY, 8) })).find(
    (i) => i.kind === 'recall_share',
  )!
  expect(a.id).toBe('recall_share')
  expect(b.id).toBe(a.id)
  expect(shownInsights([b], new Set([a.id]))).toEqual([])
})

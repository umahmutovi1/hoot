import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { SLOT_PARTS, type SlotPart } from '@/lib/schedule/rhythm'
import { plan } from '@/lib/scheduler/plan'
import { days, exam, FROM, state, subject, units } from '@/lib/scheduler/fixtures'
import type { PlanState } from '@/lib/scheduler/types'
import { slotSignals, type SlotObservation, type SlotSignals } from '@/lib/slots/signals'
import { applyAction, candidates, MAX_CANDIDATES, type CandidateInput } from '.'

const TODAY = FROM

const input = (s: PlanState, patch: Partial<CandidateInput> = {}): CandidateInput => ({
  state: s,
  result: plan(s),
  today: TODAY,
  behind: [],
  slots: null,
  slotCompletion: null,
  avoided: [],
  ...patch,
})

/** One subject, 20 h of work, an exam in 5 days: a deficit. */
function tight(over: Partial<PlanState> = {}) {
  const a = units('a', 20, 60)
  return state({
    days: days(10, [{ startMin: 9 * 60, endMin: 21 * 60 }], 180),
    subjects: [subject('a', { priority: 3 })],
    units: a,
    goals: [
      exam(
        'ea',
        'a',
        addDays(FROM, 5),
        a.map((u) => u.id),
      ),
    ],
    ...over,
  })
}

describe('strategist candidates', () => {
  it('a deficit gets more time, more priority, less scope and a shorter buffer, with effects', () => {
    const s = tight()
    const list = candidates(input(s))
    const kinds = list.map((c) => c.action.kind)
    expect(kinds).toEqual(expect.arrayContaining(['add_hours', 'drop_unit', 'change_buffer']))
    for (const c of list) {
      expect(c.effect).not.toBeNull()
      // Deficit rules are kept only when they help.
      expect(c.effect!.deficitAfter).toBeLessThan(c.effect!.deficitBefore)
    }
    // Best first.
    const gains = list.map((c) => c.effect!.deficitBefore - c.effect!.deficitAfter)
    expect([...gains].sort((x, y) => y - x)).toEqual(gains)
    // The effect is what the plan with the action applied says.
    const top = list[0]!
    const after = plan(applyAction(s, top.action, TODAY))
    expect(top.effect!.deficitAfter).toBe(
      Math.round(after.deficits.reduce((n, d) => n + d.minutes, 0)),
    )
  })

  it('ids are stable and unique; at most MAX_CANDIDATES', () => {
    const s = tight()
    const a = candidates(input(s)).map((c) => c.id)
    expect(candidates(input(s)).map((c) => c.id)).toEqual(a)
    expect(new Set(a).size).toBe(a.length)
    expect(a.length).toBeLessThanOrEqual(MAX_CANDIDATES)
  })

  it('behind the lectures: boost until the day before the exam, regular instead of campaign', () => {
    const a = units('a', 4, 60)
    const s = state({
      subjects: [subject('a', { mode: 'campaign' })],
      units: a,
      goals: [
        exam(
          'ea',
          'a',
          addDays(FROM, 20),
          a.map((u) => u.id),
        ),
      ],
    })
    const list = candidates(
      input(s, { behind: [{ subjectId: 'a', behindMinutes: 300, actions: [] }] }),
    )
    expect(list.map((c) => c.action)).toEqual(
      expect.arrayContaining([
        { kind: 'boost_priority', subjectId: 'a', until: addDays(FROM, 19) },
        { kind: 'set_mode', subjectId: 'a', mode: 'regular' },
      ]),
    )
  })

  it('crowded exams: a campaign subject starts a week earlier', () => {
    const a = units('a', 6, 60)
    const b = units('b', 6, 60)
    const s = state({
      subjects: [subject('a'), subject('b', { mode: 'campaign' })],
      units: [...a, ...b],
      goals: [
        exam(
          'ea',
          'a',
          addDays(FROM, 20),
          a.map((u) => u.id),
        ),
        exam(
          'eb',
          'b',
          addDays(FROM, 22),
          b.map((u) => u.id),
        ),
      ],
    })
    const result = plan(s)
    const list = candidates(input(s, { result }))
    const start = result.campaignStarts.b!
    expect(list.map((c) => c.action)).toContainEqual({
      kind: 'set_campaign_start',
      subjectId: 'b',
      start: addDays(start, -7) < FROM ? FROM : addDays(start, -7),
    })
  })

  it('read but never tested before an exam: checks first', () => {
    const a = units('a', 5, 60, { level: 1 })
    const s = state({
      subjects: [subject('a')],
      units: a,
      goals: [
        exam(
          'ea',
          'a',
          addDays(FROM, 10),
          a.map((u) => u.id),
        ),
      ],
    })
    const c = candidates(input(s)).find((x) => x.action.kind === 'reprioritize_unit')!
    expect(c.action).toEqual({
      kind: 'reprioritize_unit',
      subjectId: 'a',
      unitIds: a.map((u) => u.id),
    })
    const applied = applyAction(s, c.action, TODAY)
    expect(applied.units.every((u) => u.nextReviewOn === TODAY)).toBe(true)
  })

  it('slots: avoid a clearly bad one, add a clearly good one, only from 6 sessions', () => {
    const obs = (part: SlotPart, focus: number, n: number): SlotObservation[] =>
      Array.from({ length: n }, (_, i) => ({
        onDate: addDays(TODAY, -1 - i),
        part,
        weekend: false,
        focus,
        hard: false,
        speed: 1,
        startDelayMin: 0,
        minutes: 50,
        leaves: 0,
      }))
    const signals = (n: number): SlotSignals =>
      slotSignals(
        [...obs('morning', 1, n), ...obs('evening', 3, n), ...obs('afternoon', 2, 12)],
        TODAY,
      )
    const a = units('a', 4, 60)
    const s = state({
      subjects: [subject('a')],
      units: a,
      goals: [
        exam(
          'ea',
          'a',
          addDays(FROM, 20),
          a.map((u) => u.id),
        ),
      ],
    })
    const actions = candidates(input(s, { slots: signals(20) })).map((c) => c.action)
    expect(actions).toContainEqual({ kind: 'avoid_slot', weekend: false, part: 'morning' })
    expect(actions).toContainEqual({ kind: 'add_slot', weekend: false, part: 'evening' })
    const few = candidates(input(s, { slots: signals(5) })).map((c) => c.action.kind)
    expect(few).not.toContain('avoid_slot')
    expect(few).not.toContain('add_slot')
  })

  it('an avoided subject gets a first step tomorrow in the best part of the day, no effect', () => {
    const a = units('a', 4, 60)
    const scores = Object.fromEntries(SLOT_PARTS.map((p) => [p, 0.5])) as Record<SlotPart, number>
    const s = state({
      subjects: [subject('a')],
      units: a,
      goals: [
        exam(
          'ea',
          'a',
          addDays(FROM, 20),
          a.map((u) => u.id),
        ),
      ],
      slotScores: { weekday: { ...scores, evening: 0.8 }, weekend: scores },
    })
    const c = candidates(input(s, { avoided: ['a', 'gone'] }))
    const step = c.filter((x) => x.rule === 'avoidance')
    expect(step).toEqual([
      {
        id: 'first_step:a',
        rule: 'avoidance',
        action: { kind: 'first_step', subjectId: 'a', on: addDays(TODAY, 1), part: 'evening' },
        effect: null,
      },
    ])
  })

  it('avoid_slot removes the part from free time from tomorrow on; add_slot adds it', () => {
    const s = state({ days: days(3, [{ startMin: 9 * 60, endMin: 21 * 60 }]) })
    const avoided = applyAction(s, { kind: 'avoid_slot', weekend: false, part: 'midday' }, TODAY)
    expect(avoided.days[0]!.slots).toEqual(s.days[0]!.slots)
    expect(avoided.days[1]!.slots).toEqual([
      { startMin: 9 * 60, endMin: 12 * 60 },
      { startMin: 15 * 60, endMin: 21 * 60 },
    ])
    const added = applyAction(s, { kind: 'add_slot', weekend: false, part: 'evening' }, TODAY)
    expect(added.days[1]!.slots).toEqual([{ startMin: 9 * 60, endMin: 23 * 60 }])
  })

  it('property: deficit candidates never make the deficit worse; the input state is untouched', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 30 }),
        fc.integer({ min: 3, max: 12 }),
        fc.integer({ min: 60, max: 300 }),
        fc.integer({ min: 1, max: 5 }),
        (count, examDay, cap, priority) => {
          const a = units('a', count, 60)
          const s = state({
            days: days(14, [{ startMin: 9 * 60, endMin: 21 * 60 }], cap),
            subjects: [subject('a', { priority })],
            units: a,
            goals: [
              exam(
                'ea',
                'a',
                addDays(FROM, examDay),
                a.map((u) => u.id),
              ),
            ],
          })
          const frozen = JSON.stringify(s)
          for (const c of candidates(input(s)))
            if (c.rule === 'deficit')
              expect(c.effect!.deficitAfter).toBeLessThan(c.effect!.deficitBefore)
          expect(JSON.stringify(s)).toBe(frozen)
        },
      ),
      { numRuns: 40 },
    )
  })
})

it('Sprint 17 offers measured rhythm as a candidate with a deterministic preset effect', () => {
  const s = tight({
    preset: {
      kind: 'cycle',
      id: 'standard',
      steps: [
        { kind: 'work', min: 50 },
        { kind: 'break', min: 15 },
      ],
      longBreak: null,
    },
  })
  const rhythm = { sessions: 8, firstBreakMin: 38, pauseMin: 12, earlyShare: 0.2 }
  const candidate = candidates(input(s, { rhythm })).find((c) => c.action.kind === 'set_preset')!
  expect(candidate.id).toBe('set_preset:40:10')
  expect(candidate.rule).toBe('rhythm')
  expect(candidate.effect).not.toBeNull()
  expect(applyAction(s, candidate.action, TODAY).preset).toMatchObject({
    kind: 'cycle',
    steps: [
      { kind: 'work', min: 40 },
      { kind: 'break', min: 10 },
    ],
  })
})

import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { addPerDay, boostEffect, cutCandidates, plan, suggestions, type SuggestionInput } from '.'
import { exam, FROM, state, subject, units } from './fixtures'

const day = (n: number) => addDays(FROM, n)

function crowded() {
  const a = units('a', 20, 60)
  const b = units('b', 20, 60)
  return state({
    subjects: [subject('a', { priority: 2 }), subject('b', { priority: 4 })],
    units: [...a, ...b],
    goals: [
      exam(
        'ea',
        'a',
        day(8),
        a.map((u) => u.id),
      ),
      exam(
        'eb',
        'b',
        day(8),
        b.map((u) => u.id),
      ),
    ],
  })
}

const input = (over: Partial<SuggestionInput>): SuggestionInput => {
  const s = over.state ?? crowded()
  return {
    state: s,
    result: plan(s),
    today: FROM,
    behind: [],
    targetGrade: [],
    examPeriods: [],
    missedStreak: 0,
    previousDeficit: null,
    ...over,
  }
}

describe('suggestions', () => {
  it('a deficit offers more minutes a day and a cut from the lowest priority', () => {
    const list = suggestions(input({}))
    const deficits = list.filter((s) => s.kind === 'deficit')
    expect(deficits.length).toBeGreaterThan(0)
    const d = deficits[0]!
    if (d.kind !== 'deficit') throw new Error()
    expect(d.addPerDay % 15).toBe(0)
    expect(d.cut[0]!.subjectId).toBe('a')
    expect(d.cut.reduce((s, c) => s + c.minutes, 0)).toBeGreaterThanOrEqual(d.minutes)
  })

  it('missed days in a row turn deficits into one fresh start', () => {
    const list = suggestions(input({ missedStreak: 2 }))
    expect(list[0]!.kind).toBe('fresh_start')
    expect(list.some((s) => s.kind === 'deficit')).toBe(false)
  })

  it('a growing deficit is also a fresh start', () => {
    expect(suggestions(input({ previousDeficit: 10 }))[0]!.kind).toBe('fresh_start')
  })

  it('behind: raise priority, take time from another subject (with minutes), add minutes', () => {
    const a = units('a', 30, 60)
    const b = units('b', 30, 60)
    const s = state({
      subjects: [subject('a'), subject('b')],
      units: [...a, ...b],
      goals: [
        exam(
          'ea',
          'a',
          day(25),
          a.map((u) => u.id),
        ),
        exam(
          'eb',
          'b',
          day(26),
          b.map((u) => u.id),
        ),
      ],
    })
    const list = suggestions(
      input({
        state: s,
        behind: [
          {
            subjectId: 'a',
            behindMinutes: 300,
            actions: ['raise_priority', 'take_time_from', 'add_minutes'],
          },
        ],
      }),
    )
    const behind = list.find((x) => x.kind === 'behind')!
    if (behind.kind !== 'behind') throw new Error()
    expect(behind.actions[0]).toEqual({ kind: 'raise_priority', priority: 4 })
    expect(behind.actions[1]).toMatchObject({
      kind: 'take_time_from',
      donorId: 'b',
      until: day(24),
    })
    expect(behind.actions[2]).toMatchObject({ kind: 'add_minutes', until: day(24) })
  })

  it('announces a campaign 3 days before its start and an exam period with a low cap', () => {
    const c = units('c', 8, 60)
    const s = state({
      subjects: [subject('c', { mode: 'campaign', campaignStartOn: day(2) })],
      units: c,
      goals: [
        exam(
          'ec',
          'c',
          day(20),
          c.map((u) => u.id),
        ),
      ],
    })
    const list = suggestions(
      input({ state: s, examPeriods: [{ id: 'p1', startsOn: day(1), endsOn: day(14) }] }),
    )
    expect(list.map((x) => x.kind)).toEqual(['exam_period', 'campaign_soon'])
    expect(list[1]).toMatchObject({ start: day(2), days: 2 })
  })

  it('target grade out of reach suggests "Važan"', () => {
    const s = crowded()
    expect(
      suggestions(input({ state: s, targetGrade: ['a'] })).find((x) => x.kind === 'target_grade'),
    ).toMatchObject({
      subjectId: 'a',
      priority: 4,
    })
  })
})

describe('suggestion helpers', () => {
  it('addPerDay spreads minutes over days with free time, after ρ and reserve', () => {
    const s = state({ rho: 1 })
    expect(addPerDay(s, 90, day(4))).toBe(30)
  })

  it('cutCandidates covers the deficit', () => {
    const s = crowded()
    const cut = cutCandidates(s, 'eb', 120)
    expect(cut.map((c) => c.subjectId)).toEqual(['a', 'a'])
  })

  it('boostEffect is null for a lone subject', () => {
    const a = units('a', 30, 60)
    const s = state({
      subjects: [subject('a')],
      units: a,
      goals: [
        exam(
          'ea',
          'a',
          day(20),
          a.map((u) => u.id),
        ),
      ],
    })
    expect(boostEffect(s, 'a', day(10))).toBeNull()
  })
})

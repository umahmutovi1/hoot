import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { fitCompletion, type BlockFeatures, type CompletionLabel } from '@/lib/slots/completion'
import {
  forecast,
  forecastMethod,
  type ForecastBlock,
  type ForecastGoal,
  type ForecastInput,
} from './forecast'

const TODAY = '2026-11-02'
const features: BlockFeatures = {
  part: 'afternoon',
  weekend: false,
  kind: 'learn',
  demand: 1,
  dayLoadMin: 60,
  daysToGoal: 10,
  prevLate: false,
}
const block = (day: number, minutes = 60, patch: Partial<ForecastBlock> = {}): ForecastBlock => ({
  onDate: addDays(TODAY, day),
  minutes,
  subjectId: 's',
  goalId: 'e',
  learn: true,
  features,
  ...patch,
})
const goal = (patch: Partial<ForecastGoal> = {}): ForecastGoal => ({
  id: 'e',
  on: addDays(TODAY, 10),
  scopeMinutes: 600,
  coveredMinutes: 0,
  requiredMinutes: 540,
  recallOnExam: 0.9,
  ...patch,
})
const capacity = (perDay: number, days = 30) =>
  Object.fromEntries(Array.from({ length: days }, (_, i) => [addDays(TODAY, i), perDay]))
const input = (patch: Partial<ForecastInput> = {}): ForecastInput => ({
  today: TODAY,
  blocks: Array.from({ length: 10 }, (_, i) => block(i)),
  goals: [goal()],
  completion: null,
  history: [],
  capacity: capacity(60),
  speedSd: 0,
  seed: 42,
  runs: 300,
  ...patch,
})
const labelled = (label: CompletionLabel, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    ...features,
    subjectId: 's',
    onDate: addDays(TODAY, -1 - (i % 20)),
    label,
  }))

describe('forecast', () => {
  it('same seed, same forecast', () => {
    expect(forecast(input())).toEqual(forecast(input()))
  })

  it('without history it uses capacity × ρ with noise: a range, not one number', () => {
    const f = forecast(input({ goals: [goal({ requiredMinutes: 600 })] }))
    expect(f.method).toBe('capacity')
    const [g] = f.goals
    expect(g!.coverage.p10).toBeLessThan(g!.coverage.p90)
    expect(g!.coverage.p90).toBeLessThanOrEqual(1)
    // 10 days × 60 ± 30% against all 600 minutes: about a coin toss.
    expect(g!.pRequired).toBeGreaterThan(0.2)
    expect(g!.pRequired).toBeLessThan(0.9)
    expect(g!.score.p50).toBeCloseTo(g!.coverage.p50 * 0.9, 2)
  })

  it('plenty of time: sure to make it; far too little: no chance', () => {
    const plenty = forecast(input({ capacity: capacity(200) })).goals[0]!
    expect(plenty.pRequired).toBe(1)
    expect(plenty.coverage.p50).toBe(1)
    const little = forecast(input({ capacity: capacity(20) })).goals[0]!
    expect(little.pRequired).toBe(0)
    expect(little.coverage.p90).toBeLessThan(0.5)
  })

  it('bootstrap from the last 28 days once 7 days are known', () => {
    const history = Array.from({ length: 14 }, (_, i) => ({
      date: addDays(TODAY, -1 - i),
      minutes: 90,
    }))
    expect(forecastMethod({ completion: null, history, today: TODAY })).toBe('bootstrap')
    expect(forecastMethod({ completion: null, history: history.slice(0, 6), today: TODAY })).toBe(
      'capacity',
    )
    const f = forecast(input({ history }))
    expect(f.method).toBe('bootstrap')
    // 90 min every day takes all 600 planned minutes in 7 days.
    expect(f.goals[0]!.pRequired).toBe(1)
  })

  it('with the completion model: blocks usually done → likely; usually skipped → unlikely', () => {
    const done = fitCompletion(labelled('done', 40), TODAY)
    const skipped = fitCompletion(labelled('skipped', 40), TODAY)
    const good = forecast(input({ completion: done }))
    const bad = forecast(input({ completion: skipped }))
    expect(good.method).toBe('model')
    expect(good.goals[0]!.coverage.p50).toBeGreaterThan(bad.goals[0]!.coverage.p50)
    expect(good.goals[0]!.pRequired).toBeGreaterThan(bad.goals[0]!.pRequired)
  })

  it('only work before the exam day counts; reviews only take time', () => {
    // Time only from the exam day on: nothing counts.
    const late = forecast(
      input({
        blocks: [block(10, 600)],
        capacity: { [addDays(TODAY, 10)]: 600, [addDays(TODAY, 11)]: 600 },
      }),
    ).goals[0]!
    expect(late.coverage.p90).toBe(0)
    const reviews = forecast(
      input({
        blocks: [
          block(0, 600, { learn: false }),
          ...Array.from({ length: 9 }, (_, i) => block(i + 1)),
        ],
        capacity: capacity(600),
      }),
    ).goals[0]!
    // The review day takes the first day's minutes; the learning still fits in the rest.
    expect(reviews.coverage.p50).toBeCloseTo(0.9, 2)
  })

  it('slower than estimated covers less', () => {
    const sure = forecast(input({ capacity: capacity(60), runs: 400 })).goals[0]!
    const unsure = forecast(input({ capacity: capacity(60), speedSd: 0.5, runs: 400 })).goals[0]!
    expect(unsure.coverage.p90 - unsure.coverage.p10).toBeGreaterThan(
      sure.coverage.p90 - sure.coverage.p10,
    )
  })

  it('property: percentiles are ordered, shares in [0, 1], already covered is a floor', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            day: fc.integer({ min: 0, max: 14 }),
            minutes: fc.integer({ min: 5, max: 120 }),
          }),
          {
            maxLength: 15,
          },
        ),
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 1, max: 15 }),
        fc.integer({ min: 0, max: 600 }),
        (rows, perDay, examDay, coveredMinutes) => {
          const f = forecast(
            input({
              blocks: rows.map((r) => block(r.day, r.minutes)),
              goals: [goal({ on: addDays(TODAY, examDay), coveredMinutes })],
              capacity: capacity(perDay),
              runs: 50,
            }),
          )
          const g = f.goals[0]!
          for (const r of [g.coverage, g.score]) {
            expect(r.p10).toBeLessThanOrEqual(r.p50)
            expect(r.p50).toBeLessThanOrEqual(r.p90)
            expect(r.p10).toBeGreaterThanOrEqual(0)
            expect(r.p90).toBeLessThanOrEqual(1)
          }
          expect(g.coverage.p10).toBeGreaterThanOrEqual(Math.min(1, coveredMinutes / 600) - 0.001)
          expect(g.pRequired).toBeGreaterThanOrEqual(0)
          expect(g.pRequired).toBeLessThanOrEqual(1)
        },
      ),
      { numRuns: 60 },
    )
  })

  it('past exams and empty scopes are left out', () => {
    const f = forecast(input({ goals: [goal({ on: TODAY }), goal({ id: 'x', scopeMinutes: 0 })] }))
    expect(f.goals).toEqual([])
  })
})

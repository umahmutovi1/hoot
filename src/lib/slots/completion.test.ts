import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { seededRandom } from '@/lib/scheduler/hash'
import { SLOT_PARTS, type SlotPart } from '@/lib/schedule/rhythm'
import cases from './completion.cases.json'
import {
  COMPLETION_PRIORS,
  completionProbability,
  featureVector,
  fitCompletion,
  sampleFixed,
  sigmoid,
  subjectEffects,
  type BlockFeatures,
  type CompletionExample,
} from './completion'

const TODAY = '2026-12-01'

/** Blocks drawn from a known truth: base logit, part effects and per-subject shifts. */
function draw(
  seed: number,
  n: number,
  truth: { base: number; part: Partial<Record<SlotPart, number>>; subject: Record<string, number> },
  partOf: (subject: string, r: () => number) => SlotPart = (_, r) =>
    SLOT_PARTS[Math.floor(r() * 4)]!,
): CompletionExample[] {
  const r = seededRandom(seed)
  const subjects = Object.keys(truth.subject)
  return Array.from({ length: n }, (_, i) => {
    const subjectId = subjects[i % subjects.length]!
    const part = partOf(subjectId, r)
    const z = truth.base + (truth.part[part] ?? 0) + truth.subject[subjectId]!
    const done = r() < sigmoid(z)
    return {
      subjectId,
      onDate: addDays(TODAY, -1 - Math.floor(i / 10)),
      label: done ? 'done' : r() < 0.4 ? 'skipped' : 'unconfirmed',
      part,
      weekend: false,
      kind: 'learn',
      demand: 1,
      dayLoadMin: 120,
      daysToGoal: null,
      prevLate: false,
    }
  })
}

const block = {
  weekend: false,
  kind: 'learn',
  demand: 1,
  dayLoadMin: 120,
  daysToGoal: null,
  prevLate: false,
} as const

describe('fitCompletion', () => {
  it('without examples it is the prior', () => {
    const post = fitCompletion([], TODAY)
    expect(post.subjects).toEqual([])
    expect(post.mean[0]).toBeCloseTo(COMPLETION_PRIORS.mean.intercept, 10)
    expect(post.cov[0]![0]).toBeCloseTo(COMPLETION_PRIORS.sd.intercept ** 2, 10)
  })

  it('preferred parts start higher', () => {
    const post = fitCompletion([], TODAY, ['morning'])
    const morning = completionProbability(post, { ...block, part: 'morning' })
    const midday = completionProbability(post, { ...block, part: 'midday' })
    expect(morning).toBeGreaterThan(midday)
  })

  it('finds the avoided subject; the others stay near 0', () => {
    const examples = draw(1, 400, { base: 1.4, part: {}, subject: { a: -1.2, b: 0, c: 0 } })
    const effects = subjectEffects(fitCompletion(examples, TODAY))
    const a = effects.find((e) => e.subjectId === 'a')!
    expect(a.mean + 2 * a.sd).toBeLessThan(0)
    for (const e of effects.filter((x) => x.subjectId !== 'a'))
      expect(Math.abs(e.mean)).toBeLessThan(2 * e.sd + 0.1)
  })

  it('a subject always put into a bad slot is not blamed for the slot', () => {
    // Subject "a" only gets evening blocks, which fail for every subject; no subject is avoided.
    const examples = draw(
      2,
      600,
      { base: 1.4, part: { evening: -1.5 }, subject: { a: 0, b: 0, c: 0 } },
      (s, r) => (s === 'a' || r() < 0.3 ? 'evening' : 'morning'),
    )
    const post = fitCompletion(examples, TODAY)
    const a = subjectEffects(post).find((e) => e.subjectId === 'a')!
    expect(Math.abs(a.mean)).toBeLessThan(2 * a.sd)
    const evening = completionProbability(post, { ...block, part: 'evening' })
    const morning = completionProbability(post, { ...block, part: 'morning' })
    expect(morning - evening).toBeGreaterThan(0.2)
  })

  it('unconfirmed blocks count less than explicit skips', () => {
    const base = draw(3, 60, { base: 1, part: {}, subject: { a: 0 } }).map((e) => ({
      ...e,
      label: 'done' as const,
    }))
    const misses = (label: 'skipped' | 'unconfirmed') =>
      Array.from({ length: 40 }, (_, i) => ({ ...base[i]!, label }))
    const p = (label: 'skipped' | 'unconfirmed') =>
      completionProbability(fitCompletion([...base, ...misses(label)], TODAY), {
        ...block,
        part: 'morning',
      })
    expect(p('unconfirmed')).toBeGreaterThan(p('skipped'))
  })

  it('older blocks weigh less', () => {
    const recent = draw(4, 40, { base: 3, part: {}, subject: { a: 0 } }).map((e) => ({
      ...e,
      label: 'skipped' as const,
      onDate: addDays(TODAY, -2),
    }))
    const old = recent.map((e) => ({ ...e, onDate: addDays(TODAY, -120) }))
    const p = (xs: CompletionExample[]) =>
      completionProbability(fitCompletion(xs, TODAY), { ...block, part: 'morning' })
    expect(p(old)).toBeGreaterThan(p(recent))
  })

  it('a posterior draw moves the fixed effects only, and keeps the subjects', () => {
    const post = fitCompletion(draw(5, 100, { base: 1, part: {}, subject: { a: 0, b: -1 } }), TODAY)
    const r = seededRandom(9)
    const normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
    const s = sampleFixed(post, normal)
    expect(s.mean.slice(0, featureVector({ ...block, part: 'morning' }).length)).not.toEqual(
      post.mean.slice(0, featureVector({ ...block, part: 'morning' }).length),
    )
    expect(s.mean.slice(-2)).toEqual(post.mean.slice(-2))
  })
})

describe('TS = Python', () => {
  it('the cases shared with ml/', () => {
    for (const c of cases.cases) {
      const post = fitCompletion(
        c.examples as CompletionExample[],
        cases.today,
        c.preferred as SlotPart[],
      )
      post.mean.forEach((v, i) => expect(v).toBeCloseTo(c.expected.mean[i]!, 9))
      subjectEffects(post).forEach((e, i) => {
        expect(e.subjectId).toBe(c.expected.subjects[i]!.subjectId)
        expect(e.mean).toBeCloseTo(c.expected.subjects[i]!.mean, 9)
        expect(e.sd).toBeCloseTo(c.expected.subjects[i]!.sd, 9)
      })
      cases.queries.forEach((q, i) =>
        expect(completionProbability(post, q as BlockFeatures, q.subjectId)).toBeCloseTo(
          c.expected.probabilities[i]!,
          9,
        ),
      )
    }
  })
})

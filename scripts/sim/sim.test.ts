import { describe, expect, it } from 'vitest'
import baseline from './baseline.json'
import { worse } from './compare'
import { rng } from './random'
import { simulate, summarize } from './run'
import { completionLogit, DEFAULT_STUDENT, simulateBlock, type BlockContext } from './student'
import { FEATURES, fitCompletion, subjectEffects } from '@/lib/slots/completion'

const neutral: BlockContext = {
  subjectIndex: 1,
  part: 'afternoon',
  weekend: false,
  kind: 'learn',
  demand: 1,
  dayLoadMin: 60,
  daysToGoal: 10,
  prevLate: false,
}

describe('student', () => {
  it('an avoided subject is less likely done, whatever the slot and the load', () => {
    for (const part of ['morning', 'evening'] as const)
      for (const dayLoadMin of [60, 300]) {
        const b = { ...neutral, part, dayLoadMin }
        expect(completionLogit(DEFAULT_STUDENT, { ...b, subjectIndex: 0 })).toBeCloseTo(
          completionLogit(DEFAULT_STUDENT, b) + DEFAULT_STUDENT.avoidLogit,
        )
      }
  })

  it('an avoided subject starts later', () => {
    const delays = (subjectIndex: number) => {
      const r = rng(3)
      let sum = 0
      for (let i = 0; i < 400; i++)
        sum += simulateBlock(DEFAULT_STUDENT, { ...neutral, subjectIndex }, r).delayMin
      return sum / 400
    }
    expect(delays(0)).toBeGreaterThan(delays(1) + DEFAULT_STUDENT.avoidDelayMin / 2)
  })

  it('elapsed time never makes a block done: not done is skipped or unconfirmed', () => {
    const r = rng(5)
    for (let i = 0; i < 500; i++) {
      const o = simulateBlock(DEFAULT_STUDENT, neutral, r)
      if (!o.done) expect(o.label).not.toBe('done')
    }
  })
})

describe('simulate', () => {
  it('the same seed gives the same run', () => {
    const a = simulate(7)
    const b = simulate(7)
    expect(b.metrics).toEqual(a.metrics)
    expect(b.examples).toEqual(a.examples)
    expect(simulate(8).examples).not.toEqual(a.examples)
  })

  it('plans with the real scheduler and logs every block with its features', () => {
    const { examples } = simulate(2)
    expect(examples.length).toBeGreaterThan(20)
    for (const e of examples) {
      expect(e.startMin).toBeGreaterThanOrEqual(0)
      expect(e.dayLoadMin).toBeGreaterThanOrEqual(e.plannedMinutes)
    }
    expect(new Set(examples.map((e) => e.label))).toEqual(
      new Set(['done', 'skipped', 'unconfirmed']),
    )
  })

  it('completion per subject: the avoided subject is below the others', () => {
    const runs = Array.from({ length: 10 }, (_, i) => simulate(i + 1).metrics)
    const s = summarize(runs)
    expect(s.completionAvoided).toBeLessThan(s.completionNeutral - 0.1)
    // Without avoidance the gap goes away.
    const flat = summarize(
      Array.from(
        { length: 10 },
        (_, i) => simulate(i + 1, { ...DEFAULT_STUDENT, avoided: [] }).metrics,
      ),
    )
    expect(flat.completionAvoided).toBe(0)
    expect(flat.completionNeutral).toBeGreaterThan(s.completionNeutral - 0.05)
  })

  it('no baseline metric got worse (DoD of every Stage 11a model)', () => {
    const runs = Array.from({ length: baseline.seeds }, (_, i) => simulate(i + 1).metrics)
    expect(worse(summarize(runs), baseline.summary)).toEqual([])
  }, 60_000)
})

describe('completion model on the simulator (DoD, decision 29 Oct 2026)', () => {
  /** Subject effects at the end of each run: share of avoided subjects found, false alarms. */
  function detection(params = DEFAULT_STUDENT, seeds = 100) {
    let found = 0
    let avoided = 0
    let alarms = 0
    let others = 0
    let slotGap = 0
    for (let seed = 1; seed <= seeds; seed++) {
      const { examples } = simulate(seed, params)
      const end = examples.reduce((m, e) => (e.onDate > m ? e.onDate : m), '')
      const post = fitCompletion(examples, end)
      slotGap += post.mean[FEATURES.indexOf('afternoon')]! - post.mean[FEATURES.indexOf('morning')]!
      for (const e of subjectEffects(post)) {
        const significant = e.mean / e.sd < -1.645
        if (params.avoided.includes(Number(e.subjectId.slice(1)))) {
          avoided++
          if (significant) found++
        } else {
          others++
          if (significant) alarms++
        }
      }
    }
    return {
      found: avoided ? found / avoided : 0,
      alarms: alarms / others,
      slotGap: slotGap / seeds,
    }
  }

  it('finds the avoided subject in >= 40% of runs, with <= 5% false alarms', () => {
    const d = detection()
    expect(d.found).toBeGreaterThanOrEqual(0.4)
    expect(d.alarms).toBeLessThanOrEqual(0.05)
  }, 60_000)

  it('keeps a bad slot apart from the subjects: the slot is blamed, no subject is', () => {
    const badAfternoon = {
      ...DEFAULT_STUDENT,
      avoided: [],
      part: { ...DEFAULT_STUDENT.part, afternoon: -1.2 },
    }
    const d = detection(badAfternoon)
    expect(d.alarms).toBeLessThanOrEqual(0.05)
    expect(d.slotGap).toBeLessThan(-0.3)
  }, 60_000)
})

describe('worse', () => {
  it('flags a metric that moved the wrong way beyond the tolerance', () => {
    const base = baseline.summary
    expect(worse({ ...base, examScore: base.examScore * 0.9 }, base)).toEqual(['examScore'])
    expect(worse({ ...base, deficitMin: base.deficitMin * 0.5 }, base)).toEqual([])
    expect(worse({ ...base, completionAvoided: 0 }, base)).toEqual([])
  })
})

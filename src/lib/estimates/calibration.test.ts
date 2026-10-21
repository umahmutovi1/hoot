import { describe, expect, it } from 'vitest'
import {
  addSamples,
  calibrate,
  defaultMode,
  isMeasured,
  rateForMode,
  sampleRate,
} from './calibration'

describe('sampleRate', () => {
  it('is minutes per unit of measure at difficulty 3', () => {
    expect(sampleRate({ minutes: 40, amountDone: 10, difficulty: 3 })).toBe(4)
  })

  it('normalizes by difficulty', () => {
    // hard chapter (×1.7): 34 min for 10 pages is a normal 2 min/page reader
    expect(sampleRate({ minutes: 34, amountDone: 10, difficulty: 5 })).toBeCloseTo(2)
  })

  it('ignores samples without time or progress', () => {
    expect(sampleRate({ minutes: 0, amountDone: 10, difficulty: 3 })).toBeNull()
    expect(sampleRate({ minutes: 10, amountDone: 0, difficulty: 3 })).toBeNull()
  })
})

describe('addSamples', () => {
  it('starts the running mean and keeps it', () => {
    const one = addSamples({ rate: null, samples: 0 }, [
      { minutes: 20, amountDone: 10, difficulty: 3 },
      { minutes: 40, amountDone: 10, difficulty: 3 },
    ])
    expect(one).toEqual({ rate: 3, samples: 2 })
    const two = addSamples(one, [{ minutes: 60, amountDone: 10, difficulty: 3 }])
    expect(two).toEqual({ rate: 4, samples: 3 })
  })

  it('changes nothing without usable samples', () => {
    const prev = { rate: 2, samples: 4 }
    expect(addSamples(prev, [{ minutes: 5, amountDone: 0, difficulty: 3 }])).toBe(prev)
  })
})

describe('rateForMode', () => {
  const source = { rate: 2, samples: 5 } // blended with base 4 → 3

  it('falls back to the source rate below 3 pair samples', () => {
    expect(rateForMode(4, source, null)).toBe(3)
    expect(rateForMode(4, source, { rate: 10, samples: 2 })).toBe(3)
  })

  it('uses the pair once it has 3 samples', () => {
    // 3/8 · 12 + 5/8 · 4 = 7
    expect(rateForMode(4, source, { rate: 12, samples: 3 })).toBe(7)
  })

  it('is the heuristic before any measurement', () => {
    expect(rateForMode(4, { rate: null, samples: 0 }, null)).toBe(4)
  })
})

describe('defaultMode', () => {
  it('first pass for an unstarted unit, review afterwards, questions for questions', () => {
    expect(defaultMode(0, false)).toBe('reading')
    expect(defaultMode(1, false)).toBe('review')
    expect(defaultMode(2, false)).toBe('review')
    expect(defaultMode(0, true)).toBe('questions')
  })
})

describe('isMeasured', () => {
  it('needs 3 finished sessions', () => {
    expect(isMeasured(2)).toBe(false)
    expect(isMeasured(3)).toBe(true)
  })
})

describe('calibrate', () => {
  const s = (
    sourceId: string,
    sessionId: string,
    mode: 'reading' | 'review' | null,
    minutes: number,
  ) => ({
    sourceId,
    sessionId,
    mode,
    minutes,
    amountDone: 10,
    difficulty: 3,
  })

  it('recomputes source, pair and session count from all samples', () => {
    const out = calibrate([
      s('a', '1', 'reading', 20),
      s('a', '1', 'reading', 40),
      s('a', '2', 'review', 60),
      s('b', '3', null, 10),
    ])
    const a = out.get('a')!
    expect(a.learned).toEqual({ rate: 4, samples: 3 })
    expect(a.measuredSessions).toBe(2)
    expect(a.pairs.get('reading')).toEqual({ rate: 3, samples: 2 })
    expect(a.pairs.get('review')).toEqual({ rate: 6, samples: 1 })
    expect(out.get('b')!.pairs.size).toBe(0)
  })

  it('equals adding the samples one by one', () => {
    const list = [
      s('a', '1', 'reading', 20),
      s('a', '2', 'reading', 50),
      s('a', '3', 'reading', 35),
    ]
    const step = list.reduce((acc, x) => addSamples(acc, [x]), {
      rate: null as number | null,
      samples: 0,
    })
    expect(calibrate(list).get('a')!.learned).toEqual(step)
  })

  it('skips samples without time or progress', () => {
    expect(calibrate([{ ...s('a', '1', null, 0) }]).size).toBe(0)
  })
})

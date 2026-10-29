import { describe, expect, it } from 'vitest'
import { DEFAULT_BOUNDARY } from '@/lib/day'
import {
  fitOf,
  MIN_REVIEWS,
  needsFit,
  paramsOf,
  parseFit,
  trainSequences,
  type FsrsFit,
  type ReviewLog,
} from './optimize'

const log = (itemId: string, reviewedAt: string, recall: 0 | 1 | 2, rating: number | null = null) =>
  ({ itemId, reviewedAt, recall, rating }) satisfies ReviewLog

const w = Array.from({ length: 21 }, (_, i) => 0.1 + i / 10)

describe('trainSequences', () => {
  it('one item per review after the first, whole local days between reviews', () => {
    const seqs = trainSequences(
      [
        log('a', '2026-10-05T10:00:00Z', 2),
        log('a', '2026-10-01T10:00:00Z', 1),
        log('a', '2026-10-15T10:00:00Z', 0, 1),
        log('b', '2026-10-01T10:00:00Z', 2),
      ],
      DEFAULT_BOUNDARY,
    )
    expect(seqs).toEqual([
      [
        { rating: 2, deltaT: 0 },
        { rating: 3, deltaT: 4 },
      ],
      [
        { rating: 2, deltaT: 0 },
        { rating: 3, deltaT: 4 },
        { rating: 1, deltaT: 10 },
      ],
    ])
  })

  it('a second review on the same local day does not count (01:30 belongs to the day before)', () => {
    const seqs = trainSequences(
      [
        log('a', '2026-10-01T10:00:00Z', 2),
        log('a', '2026-10-01T23:30:00Z', 0), // 01:30 in Sarajevo, before the 04:00 boundary
        log('a', '2026-10-03T10:00:00Z', 2),
      ],
      DEFAULT_BOUNDARY,
    )
    expect(seqs).toEqual([
      [
        { rating: 3, deltaT: 0 },
        { rating: 3, deltaT: 2 },
      ],
    ])
  })
})

describe('needsFit', () => {
  const fit: FsrsFit = {
    version: 1,
    w,
    reviews: 120,
    fittedOn: '2026-10-01',
    logLoss: 0.3,
    defaultLogLoss: 0.32,
  }
  it('from MIN_REVIEWS on, then after 50 more reviews or 30 days with new ones', () => {
    expect(needsFit(null, MIN_REVIEWS - 1, '2026-10-29')).toBe(false)
    expect(needsFit(null, MIN_REVIEWS, '2026-10-29')).toBe(true)
    expect(needsFit(fit, 160, '2026-10-20')).toBe(false)
    expect(needsFit(fit, 170, '2026-10-20')).toBe(true)
    expect(needsFit(fit, 121, '2026-10-31')).toBe(true)
    expect(needsFit(fit, 120, '2026-12-31')).toBe(false)
  })
})

describe('fitOf / paramsOf', () => {
  it('personal weights only when they beat the defaults out of sample', () => {
    expect(fitOf({ w, logLoss: 0.3, defaultLogLoss: 0.32 }, 150, '2026-10-29').w).toEqual(w)
    expect(fitOf({ w, logLoss: 0.33, defaultLogLoss: 0.32 }, 150, '2026-10-29').w).toBeNull()
    const failed = fitOf(null, 150, '2026-10-29')
    expect(failed).toMatchObject({ w: null, reviews: 150, logLoss: null })
    expect(fitOf({ w: w.slice(1), logLoss: 0.1, defaultLogLoss: 0.3 }, 150, '2026-10-29').w).toBe(
      null,
    )
  })

  it('reads the stored JSON defensively', () => {
    const stored = fitOf({ w, logLoss: 0.3, defaultLogLoss: 0.32 }, 150, '2026-10-29')
    expect(paramsOf(JSON.parse(JSON.stringify(stored)))).toEqual(w)
    expect(paramsOf(null)).toBeUndefined()
    expect(paramsOf({ ...stored, w: [...w.slice(1), Number.NaN] })).toBeUndefined()
    expect(paramsOf({ ...stored, version: 2 })).toBeUndefined()
    expect(parseFit({ ...stored, w: null })?.reviews).toBe(150)
  })
})

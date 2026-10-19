import { describe, expect, it } from 'vitest'
import {
  baseMinPerUnit,
  blendedRate,
  difficultyCorrection,
  difficultyMultiplier,
  estimateUnits,
} from '.'

describe('baseMinPerUnit', () => {
  it('uses the PRD heuristic per kind', () => {
    expect(baseMinPerUnit('book', 'pages')).toBe(4)
    expect(baseMinPerUnit('script', 'pages')).toBe(6)
    expect(baseMinPerUnit('slides', 'slides')).toBe(1.5)
    expect(baseMinPerUnit('questions', 'questions')).toBe(8)
  })

  it('other: pages like a book, items 30 min', () => {
    expect(baseMinPerUnit('other', 'pages')).toBe(4)
    expect(baseMinPerUnit('other', 'items')).toBe(30)
  })
})

describe('difficultyMultiplier', () => {
  it('maps 1–5 to 0.6–1.7', () => {
    expect([1, 2, 3, 4, 5].map(difficultyMultiplier)).toEqual([0.6, 0.8, 1, 1.3, 1.7])
  })

  it('interpolates and clamps', () => {
    expect(difficultyMultiplier(3.5)).toBeCloseTo(1.15)
    expect(difficultyMultiplier(0)).toBe(0.6)
    expect(difficultyMultiplier(9)).toBe(1.7)
  })
})

describe('difficultyCorrection', () => {
  it('is 0 without ratings', () => {
    expect(difficultyCorrection([])).toBe(0)
  })

  it('shrinks the mean difference by n/(n+3)', () => {
    // mean(5−4, 4−3, 3−2) = 1, n = 3 → 0.5
    const rated = [
      { prior: 4, user: 5 },
      { prior: 3, user: 4 },
      { prior: 2, user: 3 },
    ]
    expect(difficultyCorrection(rated)).toBeCloseTo(0.5)
  })

  it('treats a missing prior as 3', () => {
    expect(difficultyCorrection([{ prior: null, user: 5 }])).toBeCloseTo(0.5)
  })
})

describe('blendedRate', () => {
  it('is the heuristic without measurements', () => {
    expect(blendedRate(4, null, 0)).toBe(4)
  })

  it('weighs measured and heuristic half-half after 5 units, 80% after 20', () => {
    expect(blendedRate(4, 2, 5)).toBe(3)
    expect(blendedRate(4, 2, 20)).toBeCloseTo(2.4)
  })
})

describe('estimateUnits', () => {
  it('m = amount × rate × mult(d)', () => {
    const out = estimateUnits(
      [
        { id: 'a', amount: 10, priorDifficulty: 4, userDifficulty: null },
        { id: 'b', amount: 10, priorDifficulty: null, userDifficulty: null },
      ],
      4,
    )
    expect(out.get('a')!.minutes).toBeCloseTo(52)
    expect(out.get('b')!.minutes).toBeCloseTo(40)
  })

  it('rated units use their rating, the rest get the correction', () => {
    const out = estimateUnits(
      [
        { id: 'a', amount: 10, priorDifficulty: 2, userDifficulty: 5 },
        { id: 'b', amount: 10, priorDifficulty: 3, userDifficulty: null },
      ],
      1,
    )
    expect(out.get('a')!.difficulty).toBe(5)
    // correction = 1/4 · 3 = 0.75
    expect(out.get('b')!.difficulty).toBeCloseTo(3.75)
  })
})

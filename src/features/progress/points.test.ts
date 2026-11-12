import { describe, expect, it } from 'vitest'
import { project, type GradeItem, type GradeSubject } from '@/lib/grades'
import { pointsCard } from './points'

const item = (over: Partial<GradeItem> & { id: string }): GradeItem => ({
  kind: 'partial',
  at: '2026-11-01T09:00:00Z',
  pointsMax: null,
  pointsUnit: 'points',
  passMinPct: null,
  entryMinPoints: null,
  retakeOf: null,
  resultPoints: null,
  resultMax: null,
  annulled: false,
  passed: null,
  ...over,
})
const grading: GradeSubject = { pointsTotal: 100, scale: null }

// The board's Signali: 32 of 40 so far, the final carries 60.
const signali = [
  item({ id: 'k1', at: '2026-10-12T09:00:00Z', pointsMax: 40, resultPoints: 32, resultMax: 40 }),
  item({ id: 'z', kind: 'final', at: '2026-11-15T09:00:00Z', pointsMax: 60, passMinPct: 50 }),
]

describe('pointsCard', () => {
  it('ticks, goal and what the target needs', () => {
    const card = pointsCard(project(signali, grading), grading, 9, null)
    expect(card.ticks).toEqual([55, 65, 75, 85, 95])
    expect(card.goal).toBe(85)
    expect(card.call).toEqual({
      kind: 'needs',
      grade: 9,
      points: 53,
      remaining: 60,
      range: null,
      risk: false,
    })
  })

  it('the forecast band and its grades', () => {
    const card = pointsCard(project(signali, grading), grading, 9, { p10: 0.62, p90: 0.8 })
    expect(card.range!.low).toBeCloseTo(69.2)
    expect(card.range!.high).toBeCloseTo(80)
    expect(card.rangeGrades).toEqual([7, 8])
  })

  it('flags a forecast that can end below a pass', () => {
    const card = pointsCard(project(signali, grading), grading, 8, { p10: 0.4, p90: 0.7 })
    // 0.4 misses the final's 50%: 32 points only.
    expect(card.call).toMatchObject({ kind: 'needs', risk: true })
  })

  it('no results yet: the first item and the target total', () => {
    const open = [
      item({ id: 'k', at: '2026-11-18T09:00:00Z', pointsMax: 30 }),
      item({ id: 'i', kind: 'final', at: '2026-11-29T09:00:00Z', pointsMax: 70 }),
    ]
    const card = pointsCard(project(open, grading), grading, 8, null)
    expect(card.call).toEqual({ kind: 'none', first: { id: 'k', worth: 30 }, grade: 8, need: 75 })
  })

  it('a pass without a target', () => {
    const card = pointsCard(project(signali, grading), grading, null, null)
    expect(card.goalGrade).toBe(6)
    expect(card.call).toMatchObject({ kind: 'needs', grade: 6, points: 30 })
  })
})

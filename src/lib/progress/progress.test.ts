import { describe, expect, it } from 'vitest'
import {
  leavesOf,
  levelMinutes,
  progressOf,
  subjectProgress,
  subtreeLeaves,
  unitFraction,
  type ProgressUnit,
} from '.'

const u = (id: string, level: number, minutes: number, parentId: string | null = null) =>
  ({ id, level, minutes, parentId }) satisfies ProgressUnit

describe('unitFraction', () => {
  it('is level / 3; question "know" (3) is 100%', () => {
    expect([0, 1, 2, 3].map(unitFraction)).toEqual([0, 1 / 3, 2 / 3, 1])
  })
})

describe('progressOf', () => {
  it('weights by minutes, not by count', () => {
    // a short chapter done, a long one not started
    const p = progressOf([u('a', 3, 10), u('b', 0, 90)])
    expect(p.fraction).toBeCloseTo(0.1)
    expect(p.totalMinutes).toBe(100)
    expect(p.remainingMinutes).toBeCloseTo(90)
  })

  it('is empty without minutes', () => {
    expect(progressOf([]).fraction).toBe(0)
  })
})

describe('leaves', () => {
  const units = [u('1', 0, 50), u('1.1', 3, 10, '1'), u('1.2', 0, 30, '1'), u('2', 1, 60)]

  it('leavesOf drops parents', () => {
    expect(leavesOf(units).map((x) => x.id)).toEqual(['1.1', '1.2', '2'])
  })

  it('a parent takes its progress from its children', () => {
    expect(progressOf(subtreeLeaves(units, '1')).fraction).toBeCloseTo(0.25)
    expect(subtreeLeaves(units, '2').map((x) => x.id)).toEqual(['2'])
  })

  it('levelMinutes splits minutes by level', () => {
    expect(levelMinutes(leavesOf(units))).toEqual([30, 60, 0, 10])
  })
})

describe('subjectProgress', () => {
  const p = (fraction: number, totalMinutes: number) => ({
    fraction,
    totalMinutes,
    remainingMinutes: totalMinutes * (1 - fraction),
  })

  it('a single source is the subject', () => {
    expect(subjectProgress([{ weight: null, progress: p(0.4, 100) }])).toBeCloseTo(0.4)
  })

  it('default weight is the share of minutes', () => {
    const out = subjectProgress([
      { weight: null, progress: p(1, 300) },
      { weight: null, progress: p(0, 100) },
    ])
    expect(out).toBeCloseTo(0.75)
  })

  it('a manual weight takes its share, the rest split by minutes', () => {
    const out = subjectProgress([
      { weight: 0.5, progress: p(1, 10) },
      { weight: null, progress: p(0, 300) },
      { weight: null, progress: p(0.5, 100) },
    ])
    // 0.5·1 + 0.375·0 + 0.125·0.5
    expect(out).toBeCloseTo(0.5625)
  })

  it('only manual weights are normalized', () => {
    const out = subjectProgress([
      { weight: 0.2, progress: p(1, 10) },
      { weight: 0.2, progress: p(0, 10) },
    ])
    expect(out).toBeCloseTo(0.5)
  })

  it('is 0 without material', () => {
    expect(subjectProgress([])).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { SourceMaterial } from '@/features/sources/model'
import { scopeOf } from '@/lib/progress/scope'
import { choiceOf, leavesOfPick, pickOf, rowsForLeaves, sourceLeaves } from './sourceScope'

// Source with chapter 1 (1.1, 1.2 with 1.2.1, 1.2.2) and chapter 2.
const unit = (id: string, parent_id: string | null) => ({ id, parent_id }) as never
const material = {
  source: { id: 's' },
  units: [
    unit('1', null),
    unit('1.1', '1'),
    unit('1.2', '1'),
    unit('1.2.1', '1.2'),
    unit('1.2.2', '1.2'),
    unit('2', null),
  ],
} as unknown as SourceMaterial
const units = material.units.map((u) => ({ id: u.id, parentId: u.parent_id }))
const leaves = ['1.1', '1.2.1', '1.2.2', '2']

describe('source scope for one exam', () => {
  const partial = { id: 'e', scopeAll: false }
  const final = { id: 'f', scopeAll: true }

  it('lists the leaves', () => {
    expect(sourceLeaves(material)).toEqual(leaves)
  })

  it('reads all / none / part from the rows', () => {
    expect(pickOf(material, partial, []).choice).toBe('none')
    expect(pickOf(material, final, []).choice).toBe('all')
    const part = pickOf(material, partial, [{ assessmentId: 'e', unitId: '1', included: true }])
    expect(part.choice).toBe('part')
    expect([...part.leaves]).toEqual(['1.1', '1.2.1', '1.2.2'])
  })

  it('turns a pick into leaves', () => {
    const some = new Set(['2'])
    expect(leavesOfPick(material, { choice: 'all', leaves: some }).size).toBe(4)
    expect(leavesOfPick(material, { choice: 'none', leaves: some }).size).toBe(0)
    expect(leavesOfPick(material, { choice: 'part', leaves: some })).toBe(some)
    expect(choiceOf(material, some)).toBe('part')
  })

  it('writes top-level rows when a whole chapter is in or out', () => {
    expect(rowsForLeaves(material, partial, new Set(leaves))).toEqual([
      { assessmentId: 'e', unitId: '1', included: true },
      { assessmentId: 'e', unitId: '2', included: true },
    ])
    expect(rowsForLeaves(material, partial, new Set())).toEqual([])
    expect(rowsForLeaves(material, final, new Set(leaves))).toEqual([])
    expect(rowsForLeaves(material, final, new Set(['1.1', '1.2.1', '1.2.2']))).toEqual([
      { assessmentId: 'f', unitId: '2', included: false },
    ])
  })

  it('goes down only where a chapter is split', () => {
    expect(rowsForLeaves(material, partial, new Set(['1.1', '1.2.1']))).toEqual([
      { assessmentId: 'e', unitId: '1.1', included: true },
      { assessmentId: 'e', unitId: '1.2.1', included: true },
    ])
  })

  it('covers exactly the picked leaves', () => {
    fc.assert(
      fc.property(fc.subarray(leaves), fc.boolean(), (picked, scopeAll) => {
        const exam = { id: 'x', scopeAll }
        const rows = rowsForLeaves(material, exam, new Set(picked))
        const scope = scopeOf(exam, units, rows)
        expect(leaves.filter((l) => scope.has(l)).sort()).toEqual([...picked].sort())
      }),
    )
  })
})

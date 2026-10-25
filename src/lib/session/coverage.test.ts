import { describe, expect, it } from 'vitest'
import { coverage, pageOffset } from './coverage'

const units = [
  { id: 'a', amount: 10 },
  { id: 'b', amount: 10 },
  { id: 'c', amount: 7 },
]

describe('coverage', () => {
  it('covers whole units between the start and the reached point', () => {
    expect(coverage(units, { unitId: 'a', offset: 0 }, { unitId: 'c', offset: 3 })).toEqual([
      { unitId: 'a', amountDone: 10, complete: true, end: 10 },
      { unitId: 'b', amountDone: 10, complete: true, end: 10 },
      { unitId: 'c', amountDone: 3, complete: false, end: 3 },
    ])
  })

  it('starts mid-unit and ends inside the same unit', () => {
    expect(coverage(units, { unitId: 'b', offset: 4 }, { unitId: 'b', offset: 9 })).toEqual([
      { unitId: 'b', amountDone: 5, complete: false, end: 9 },
    ])
  })

  it('clamps offsets and marks the end of a unit as complete', () => {
    expect(coverage(units, { unitId: 'b', offset: -3 }, { unitId: 'b', offset: 99 })).toEqual([
      { unitId: 'b', amountDone: 10, complete: true, end: 10 },
    ])
  })

  it('is empty when the end is before the start or unknown', () => {
    expect(coverage(units, { unitId: 'c', offset: 0 }, { unitId: 'a', offset: 5 })).toEqual([])
    expect(coverage(units, { unitId: 'x', offset: 0 }, { unitId: 'a', offset: 5 })).toEqual([])
  })
})

describe('pageOffset', () => {
  it('reaching the first page means one page read', () => {
    expect(pageOffset(142, 142)).toBe(1)
    expect(pageOffset(142, 151)).toBe(10)
  })
})

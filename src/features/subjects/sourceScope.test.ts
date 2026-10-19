import { describe, expect, it } from 'vitest'
import type { SourceMaterial } from '@/features/sources/model'
import { rowsForSource, sourceState } from './sourceScope'

// Source with chapter 1 (1.1, 1.2) and chapter 2.
const unit = (id: string, parent_id: string | null) => ({ id, parent_id }) as never
const material = {
  source: { id: 's' },
  units: [unit('1', null), unit('1.1', '1'), unit('1.2', '1'), unit('2', null)],
} as unknown as SourceMaterial

describe('source scope for one exam', () => {
  const partial = { id: 'e', scopeAll: false }
  const final = { id: 'f', scopeAll: true }

  it('reads all / none / part from the rows', () => {
    expect(sourceState(material, partial, [])).toBe('none')
    expect(sourceState(material, final, [])).toBe('all')
    const part = [{ assessmentId: 'e', unitId: '1', included: true }]
    expect(sourceState(material, partial, part)).toBe('part')
  })

  it('writes top-level rows only when they change the default', () => {
    expect(rowsForSource(material, partial, 'all')).toEqual([
      { assessmentId: 'e', unitId: '1', included: true },
      { assessmentId: 'e', unitId: '2', included: true },
    ])
    expect(rowsForSource(material, partial, 'none')).toEqual([])
    expect(rowsForSource(material, final, 'all')).toEqual([])
    expect(rowsForSource(material, final, 'none').every((r) => !r.included)).toBe(true)
  })
})

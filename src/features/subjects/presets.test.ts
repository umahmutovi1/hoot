import { describe, expect, it } from 'vitest'
import { presetExams } from './presets'

describe('presetExams', () => {
  it('final: one exam over the whole material', () => {
    expect(presetExams('final')).toEqual([
      { kind: 'final', titleKey: 'final', scopeAll: true, contingent: false },
    ])
  })

  it('partials: two partials with own scope plus a contingent integral', () => {
    const exams = presetExams('partials')
    expect(exams.map((e) => e.titleKey)).toEqual(['partial1', 'partial2', 'integral'])
    expect(exams.map((e) => e.scopeAll)).toEqual([false, false, true])
    expect(exams.map((e) => e.contingent)).toEqual([false, false, true])
    expect(exams[2]?.kind).toBe('integral')
  })

  it('custom: no exams', () => {
    expect(presetExams('custom')).toEqual([])
  })
})

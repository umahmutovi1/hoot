import { describe, expect, it } from 'vitest'
import { assessmentRow } from './fixtures'
import { isShownExam, nextAssessment, shownExams } from './model'

describe('makeup visibility', () => {
  const exam = assessmentRow({ id: 'e', kind: 'partial', at: '2026-11-01T08:00:00Z' })
  const makeup = assessmentRow({
    id: 'm',
    kind: 'makeup',
    retake_of: 'e',
    at: '2026-11-20T08:00:00Z',
  })

  it('hides a makeup until its exam is known to be failed', () => {
    expect(isShownExam(makeup, [exam, makeup])).toBe(false)
    const failed = { ...exam, result_points: 8, passed: false }
    expect(isShownExam(makeup, [failed, makeup])).toBe(true)
    const annulled = { ...exam, result_annulled: true }
    expect(isShownExam(makeup, [annulled, makeup])).toBe(true)
    const passed = { ...exam, result_points: 30, passed: true }
    expect(isShownExam(makeup, [passed, makeup])).toBe(false)
    expect(shownExams([exam, makeup]).map((e) => e.id)).toEqual(['e'])
  })

  it('the next exam is never a hidden makeup', () => {
    const now = new Date('2026-11-05T08:00:00Z')
    expect(nextAssessment([exam, makeup], now)).toBeUndefined()
    expect(nextAssessment([{ ...exam, result_points: 8 }, makeup], now)?.id).toBe('m')
  })
})

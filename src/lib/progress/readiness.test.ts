import { describe, expect, it } from 'vitest'
import { overestimation } from './readiness'
const exam = { readiness_before: 4, result_points: 65, result_max: 100, result_annulled: false }
describe('Sprint 17 readiness calibration', () => {
  it('requires three valid results and uses the expected percentage, not grades', () => {
    expect(overestimation([exam, exam])).toBeNull()
    expect(overestimation([exam, exam, exam])).toEqual({ pairs: 3, percentagePoints: 15 })
    expect(overestimation([exam, exam, { ...exam, result_points: 80 }])).toBeNull()
  })
  it('excludes missing, waived and zero-maximum results', () => {
    expect(
      overestimation([
        exam,
        exam,
        { ...exam, result_annulled: true },
        { ...exam, result_max: 0 },
        { ...exam, readiness_before: null },
      ]),
    ).toBeNull()
  })
})

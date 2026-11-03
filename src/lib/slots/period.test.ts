import { describe, expect, it } from 'vitest'
import { sameStudyPeriod, studyPeriod } from './period'
const periods = [{ kind: 'exam', startsOn: '2026-10-19', endsOn: '2026-10-25' }]
describe('Sprint 17 study periods', () => {
  it('includes both boundaries and does not classify a teaching period as an exam', () => {
    expect(studyPeriod('2026-10-19', periods)).toBe('exam')
    expect(studyPeriod('2026-10-25', periods)).toBe('exam')
    expect(studyPeriod('2026-10-26', periods)).toBe('teaching')
    expect(studyPeriod('2026-10-19', [{ ...periods[0]!, kind: 'teaching' }])).toBe('teaching')
  })
  it('never mixes exam and teaching observations, including an empty exam history', () => {
    const rows = [
      { onDate: '2026-10-18', focus: 1 },
      { onDate: '2026-10-20', focus: 3 },
    ]
    expect(sameStudyPeriod(rows, '2026-10-21', periods)).toEqual([rows[1]])
    expect(sameStudyPeriod(rows, '2026-11-02', periods)).toEqual([rows[0]])
    expect(sameStudyPeriod([rows[0]!], '2026-10-21', periods)).toEqual([])
  })
})

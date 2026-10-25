import { describe, expect, it } from 'vitest'
import {
  currentYear,
  groupSubjects,
  isWinter,
  newYearOffer,
  semesterOn,
  yearLabelOn,
  yearRange,
  type AcademicYear,
  type SubjectTerm,
} from '.'

const y2526: AcademicYear = {
  id: 'y1',
  label: '2025/26',
  yearOfStudy: 1,
  startsOn: '2025-10-01',
  endsOn: '2026-09-30',
}
const y2627: AcademicYear = {
  id: 'y2',
  label: '2026/27',
  yearOfStudy: 2,
  startsOn: '2026-10-01',
  endsOn: '2027-09-30',
}

describe('academic year', () => {
  it('labels a day by the year starting on 1 October', () => {
    expect(yearLabelOn('2026-10-25')).toBe('2026/27')
    expect(yearLabelOn('2026-09-30')).toBe('2025/26')
    expect(yearLabelOn('2099-12-01')).toBe('2099/00')
    expect(yearRange('2026/27')).toEqual({ startsOn: '2026-10-01', endsOn: '2027-09-30' })
  })

  it('the current year covers today, else the latest one that started', () => {
    expect(currentYear([y2526, y2627], '2026-10-25')).toBe(y2627)
    const short = { ...y2526, endsOn: '2026-07-15' }
    expect(currentYear([short], '2026-08-01')).toBe(short)
    expect(currentYear([y2627], '2026-08-01')).toBeNull()
  })
})

describe('semesterOn', () => {
  const winter = { startsOn: '2026-10-05', endsOn: '2027-01-22', academicYearId: 'y2' }
  const summer = { startsOn: '2027-02-22', endsOn: '2027-06-11', academicYearId: null }

  it('counts the year’s teaching periods in the faculty numbering', () => {
    expect(semesterOn(y2627, [winter, summer], '2026-10-25')).toBe(3)
    // Between the two: the next one.
    expect(semesterOn(y2627, [winter, summer], '2027-02-01')).toBe(4)
    // After both: the last one.
    expect(semesterOn(y2627, [winter, summer], '2027-08-01')).toBe(4)
    // Before the first one starts (1–4 October): the first one.
    expect(semesterOn(y2627, [winter, summer], '2026-10-02')).toBe(3)
    expect(isWinter(3)).toBe(true)
    expect(isWinter(4)).toBe(false)
  })

  it('ignores periods of other years and falls back to the month', () => {
    const old = { startsOn: '2025-10-01', endsOn: '2026-01-20', academicYearId: 'y1' }
    expect(semesterOn(y2627, [old], '2026-11-01')).toBe(3)
    expect(semesterOn(y2627, [], '2027-03-10')).toBe(4)
    expect(semesterOn({ ...y2627, yearOfStudy: null }, [], '2026-11-01')).toBe(1)
  })
})

const subj = (id: string, over: Partial<SubjectTerm> = {}): SubjectTerm => ({
  id,
  academicYearId: 'y2',
  semesterNo: 3,
  done: false,
  activeExam: true,
  ...over,
})

describe('groupSubjects', () => {
  const current = { yearId: 'y2', semester: 3 }

  it('opens the current semester, keeps an unpassed older subject there as carried', () => {
    const g = groupSubjects(
      [
        subj('a'),
        subj('carried', { academicYearId: 'y1', semesterNo: 2, activeExam: true }),
        subj('passed', { academicYearId: 'y1', semesterNo: 2, done: true, activeExam: false }),
        subj('old', { academicYearId: 'y1', semesterNo: 1, activeExam: false }),
        subj('next', { semesterNo: 4 }),
        subj('loose', { academicYearId: null, semesterNo: null }),
      ],
      [y2526, y2627],
      current,
    )
    expect(g.current?.items.map((i) => [i.subject.id, i.carried])).toEqual([
      ['a', false],
      ['carried', true],
    ])
    expect(g.later.map((x) => x.key)).toEqual(['y2:4'])
    expect(g.earlier.map((x) => [x.key, x.items.map((i) => i.subject.id)])).toEqual([
      ['y1:2', ['passed']],
      ['y1:1', ['old']],
    ])
    expect(g.none.map((s) => s.id)).toEqual(['loose'])
  })

  it('a future subject is never carried back, and the current group exists even when empty', () => {
    const g = groupSubjects([subj('next', { semesterNo: 4 })], [y2627], current)
    expect(g.current?.items).toEqual([])
    expect(g.later[0]?.items[0]).toMatchObject({ carried: false })
  })

  it('with no current semester (the year ended) every group folds under earlier', () => {
    const g = groupSubjects([subj('a'), subj('b', { semesterNo: 4 })], [y2627], null)
    expect(g.current).toBeNull()
    expect(g.later).toEqual([])
    expect(g.earlier.map((x) => x.key)).toEqual(['y2:4', 'y2:3'])
    expect(g.earlier.flatMap((x) => x.items.map((i) => i.carried))).toEqual([false, false])
  })

  it('without academic years everything is loose', () => {
    const g = groupSubjects([subj('a', { academicYearId: null })], [], null)
    expect(g).toEqual({ current: null, later: [], earlier: [], none: [expect.anything()] })
  })
})

describe('newYearOffer', () => {
  it('offers the next year once today is past the latest one', () => {
    expect(newYearOffer([y2526], '2026-10-04')).toEqual({
      label: '2026/27',
      startsOn: '2026-10-01',
      endsOn: '2027-09-30',
      yearOfStudy: 2,
    })
    expect(newYearOffer([y2526, y2627], '2026-10-04')).toBeNull()
    expect(newYearOffer([], '2026-10-04')).toBeNull()
    expect(newYearOffer([{ ...y2526, yearOfStudy: 6 }], '2026-10-04')?.yearOfStudy).toBe(6)
  })
})

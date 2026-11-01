import { describe, expect, it } from 'vitest'
import { programSaveCount, programYears, proposeProgram } from './program'

const parsed = [
  { subject_name: 'Matematika 1', semester: 1, ects: 7, elective_group: null },
  { subject_name: 'Signali i sistemi', semester: 3, ects: 6, elective_group: null },
  { subject_name: 'Elektronika', semester: 4, ects: 6, elective_group: null },
  { subject_name: 'Robotika', semester: 5, ects: 5, elective_group: 'Izborni 5.1' },
  { subject_name: 'Mreže', semester: 5, ects: 5, elective_group: null },
]

describe('proposeProgram', () => {
  const ctx = {
    subjects: [{ id: 's1', name: 'Signali i sistemi' }],
    years: [
      { id: 'y1', label: '2026/27', yearOfStudy: 2, startsOn: '2026-10-01', endsOn: '2027-09-30' },
    ],
    today: '2026-11-03',
    yearOfStudy: 2,
    semester: 3,
  }

  it('places semesters in academic years from the current one', () => {
    const p = proposeProgram(parsed, ctx)
    expect(p.semesters.map((s) => [s.semester, s.yearLabel, s.yearId])).toEqual([
      [1, '2025/26', null],
      [3, '2026/27', 'y1'],
      [4, '2026/27', 'y1'],
      [5, '2027/28', null],
    ])
  })

  it('keeps existing subjects, skips past semesters and electives by default', () => {
    const p = proposeProgram(parsed, ctx)
    const flat = p.semesters.flatMap((s) =>
      s.subjects.map((x) => [x.name, x.include, x.existingId]),
    )
    expect(flat).toEqual([
      ['Matematika 1', false, null],
      ['Signali i sistemi', false, 's1'],
      ['Elektronika', true, null],
      ['Robotika', false, null],
      ['Mreže', true, null],
    ])
    expect(programSaveCount(p)).toBe(2)
    // Only 2027/28 is new and needed.
    expect(programYears(p).map((y) => y.label)).toEqual(['2027/28'])
  })

  it('without the year of study there are no year labels', () => {
    const p = proposeProgram(parsed, { ...ctx, yearOfStudy: null, semester: null })
    expect(p.semesters.every((s) => s.yearLabel === null && !s.past)).toBe(true)
    expect(programYears(p)).toEqual([])
  })
})

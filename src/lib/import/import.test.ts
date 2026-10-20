import { describe, expect, it } from 'vitest'
import {
  assignSubject,
  matchSubject,
  proposeExams,
  proposePeriods,
  toSave,
  type ExistingExam,
  type ParsedExam,
} from '.'

const subjects = [
  { id: 'sis', name: 'Signali i sistemi' },
  { id: 'mat', name: 'Matematika 2' },
  { id: 'bp', name: 'Baze podataka' },
  { id: 'em', name: 'Električni mjerni instrumenti' },
]

const exam = (over: Partial<ParsedExam>): ParsedExam => ({
  subject_name: 'Signali i sistemi',
  subject_id: null,
  kind: 'partial',
  number: 2,
  date: '2026-12-03',
  time: '09:00',
  ...over,
})

const existing = (over: Partial<ExistingExam>): ExistingExam => ({
  id: 'x',
  subjectId: 'sis',
  title: 'II parcijala',
  kind: 'partial',
  date: '2026-11-25',
  time: '09:00',
  dateLatest: null,
  tentative: false,
  passed: false,
  ...over,
})

describe('matchSubject', () => {
  it('trusts the model id only when it is one of ours', () => {
    expect(matchSubject({ subject_id: 'mat', subject_name: '?' }, subjects)).toBe('mat')
    expect(matchSubject({ subject_id: 'nope', subject_name: 'Baze podataka' }, subjects)).toBe('bp')
  })

  it('matches names without diacritics, case or small typos', () => {
    expect(matchSubject({ subject_id: null, subject_name: 'BAZE PODATAKA' }, subjects)).toBe('bp')
    expect(
      matchSubject({ subject_id: null, subject_name: 'Elektricni mjerni instrumenti' }, subjects),
    ).toBe('em')
    expect(matchSubject({ subject_id: null, subject_name: 'Matematka 2' }, subjects)).toBe('mat')
  })

  it('does not force a match for a subject the user does not have', () => {
    expect(matchSubject({ subject_id: null, subject_name: 'Fizika 2' }, subjects)).toBeNull()
    expect(matchSubject({ subject_id: null, subject_name: '' }, subjects)).toBeNull()
  })
})

describe('proposeExams', () => {
  it('turns a tentative exam into an exact date instead of a duplicate', () => {
    const [p] = proposeExams([exam({ number: null })], subjects, [
      existing({ id: 'p2', tentative: true, date: '2026-11-30', dateLatest: '2026-12-11' }),
    ])
    expect(p).toMatchObject({
      status: 'changed',
      existingId: 'p2',
      existingTitle: 'II parcijala',
      include: true,
    })
    expect(p?.previous).toEqual({ date: '2026-11-30', dateLatest: '2026-12-11', tentative: true })
  })

  it('uses the ordinal of a partial ("II parcijala" = second partial)', () => {
    const [p] = proposeExams([exam({})], subjects, [
      existing({ id: 'p1', date: '2026-10-28' }),
      existing({ id: 'p2', date: '2026-12-01' }),
    ])
    expect(p).toMatchObject({ status: 'changed', existingId: 'p2' })
  })

  it('marks an identical exam unchanged and leaves it out of saving', () => {
    const proposals = proposeExams([exam({ number: 1, date: '2026-11-25' })], subjects, [
      existing({ id: 'p1' }),
    ])
    expect(proposals[0]).toMatchObject({ status: 'unchanged', include: false })
    expect(toSave(proposals)).toHaveLength(0)
  })

  it('creates new exams and skips unknown subjects', () => {
    const proposals = proposeExams(
      [exam({ subject_name: 'Matematika 2' }), exam({ subject_name: 'Fizika 2' })],
      subjects,
      [],
    )
    expect(proposals.map((p) => p.status)).toEqual(['new', 'skipped'])
    expect(toSave(proposals).map((p) => p.subjectId)).toEqual(['mat'])
  })

  it('never updates the same existing exam twice', () => {
    const proposals = proposeExams(
      [exam({ number: null, date: '2026-12-03' }), exam({ number: null, date: '2026-12-10' })],
      subjects,
      [existing({ id: 'only', tentative: true, date: '2026-12-01', dateLatest: '2026-12-12' })],
    )
    expect(proposals.map((p) => p.status)).toEqual(['changed', 'new'])
  })

  it('re-evaluates a skipped exam once a subject is picked', () => {
    const [skipped] = proposeExams([exam({ subject_name: 'Fizika 2' })], subjects, [])
    const picked = assignSubject(skipped!, 'bp', [])
    expect(picked).toMatchObject({ status: 'new', include: true, subjectId: 'bp', key: 'e0' })
  })
})

describe('proposePeriods', () => {
  const period = {
    kind: 'exam' as const,
    exam_session: 'makeup' as const,
    title: 'Popravni rok',
    starts_on: '2027-02-15',
    ends_on: '2027-02-26',
  }

  it('finds new, changed and unchanged periods', () => {
    const proposals = proposePeriods(
      [
        period,
        {
          ...period,
          exam_session: 'regular',
          title: 'Januarski rok',
          starts_on: '2027-01-25',
          ends_on: '2027-02-12',
        },
        {
          kind: 'holiday',
          exam_session: null,
          title: 'Nova godina',
          starts_on: '2027-01-01',
          ends_on: '2027-01-02',
        },
      ],
      [
        { ...period, id: 'm', starts_on: '2027-02-16' },
        {
          kind: 'exam',
          exam_session: 'regular',
          title: 'Januarsko-februarski rok',
          id: 'r',
          starts_on: '2027-01-25',
          ends_on: '2027-02-12',
        },
      ],
    )
    expect(proposals.map((p) => [p.status, p.existingId])).toEqual([
      ['changed', 'm'],
      ['unchanged', 'r'],
      ['new', null],
    ])
    expect(proposals[0]?.previous).toEqual({ starts_on: '2027-02-16', ends_on: '2027-02-26' })
    expect(toSave(proposals)).toHaveLength(2)
  })

  it('does not match a different session of the same dates', () => {
    const [p] = proposePeriods([period], [{ ...period, id: 'r', exam_session: 'regular' }])
    expect(p?.status).toBe('new')
  })
})

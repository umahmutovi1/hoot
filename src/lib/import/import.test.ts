import { describe, expect, it } from 'vitest'
import {
  assignClassSubject,
  assignSubject,
  matchSubject,
  proposeClasses,
  proposeDeadlines,
  proposeExams,
  proposePeriods,
  toSave,
  type DeadlineEvent,
  type ExistingClass,
  type ExistingExam,
  type ParsedClass,
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

describe('proposeClasses', () => {
  const subjects = [
    { id: 'sig', name: 'Signali i sistemi' },
    { id: 'baze', name: 'Baze podataka' },
  ]
  const parsed = (over: Partial<ParsedClass> = {}): ParsedClass => ({
    subject_name: 'Signali i sistemi',
    subject_id: null,
    kind: 'lecture',
    weekday: 0,
    start: '09:00',
    end: '11:00',
    location: 'S1',
    week_parity: null,
    note: null,
    ...over,
  })
  const existing: ExistingClass[] = [
    {
      id: 'e1',
      subjectId: 'sig',
      kind: 'lecture',
      weekday: 0,
      startMin: 540,
      endMin: 660,
      location: 'S1',
      weekParity: null,
    },
  ]

  it('is unchanged, changed or new against the timetable', () => {
    const out = proposeClasses(
      [
        parsed(),
        parsed({ weekday: 2, start: '12:00', end: '14:00' }),
        parsed({ subject_name: 'Baze podat.', kind: 'lab', week_parity: 'odd' }),
      ],
      subjects,
      existing,
    )
    expect(out.map((c) => [c.status, c.subjectId, c.include])).toEqual([
      ['unchanged', 'sig', false],
      ['new', 'sig', true],
      ['new', 'baze', true],
    ])
    const moved = proposeClasses([parsed({ start: '10:00', end: '12:00' })], subjects, existing)[0]!
    expect(moved).toMatchObject({ status: 'changed', existingId: 'e1' })
    expect(moved.previous).toEqual({ start: '09:00', end: '11:00', location: 'S1' })
  })

  it('waits for a subject when none matches', () => {
    const [c] = proposeClasses([parsed({ subject_name: 'Fizika' })], subjects, existing)
    expect(c).toMatchObject({ status: 'skipped', include: false })
    expect(assignClassSubject(c!, 'baze', existing)).toMatchObject({
      status: 'new',
      subjectId: 'baze',
      key: c!.key,
    })
  })
})

describe('proposeDeadlines', () => {
  const now = new Date('2026-10-23T10:00:00Z')
  const ev = (over: Partial<DeadlineEvent>): DeadlineEvent => ({
    id: 'e1',
    title: 'Zadaća 2 se predaje',
    category: 'Signali i sistemi',
    startsAt: '2026-11-04T22:59:00.000Z',
    deadlineId: null,
    ignored: false,
    ...over,
  })

  it('offers new and moved deadlines, never skipped, past or unchanged ones', () => {
    const out = proposeDeadlines(
      [
        ev({}),
        ev({ id: 'e2', deadlineId: 'd1', startsAt: '2026-11-06T22:59:00.000Z' }),
        ev({ id: 'e3', deadlineId: 'd2' }),
        ev({ id: 'e4', ignored: true }),
        ev({ id: 'e5', startsAt: '2026-10-01T10:00:00.000Z' }),
      ],
      subjects,
      [
        { id: 'd1', dueAt: '2026-11-04T22:59:00Z' },
        { id: 'd2', dueAt: '2026-11-04T22:59:00Z' },
      ],
      now,
    )
    expect(out.map((p) => [p.eventId, p.status, p.subjectId])).toEqual([
      ['e1', 'new', 'sis'],
      ['e2', 'changed', 'sis'],
    ])
    expect(out[1]!.previousDueAt).toBe('2026-11-04T22:59:00Z')
  })

  it('matches the subject by the title when the course is missing', () => {
    const [p] = proposeDeadlines(
      [ev({ category: null, title: 'Baze podataka: projekat' })],
      subjects,
      [],
      now,
    )
    expect(p!.subjectId).toBe('bp')
  })
})

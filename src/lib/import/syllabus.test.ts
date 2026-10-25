import { describe, expect, it } from 'vitest'
import { proposeSyllabus, syllabusSaveCount, type ParsedSyllabus } from './syllabus'

const SIG = 's1'
const parsed = (over: Partial<ParsedSyllabus> = {}): ParsedSyllabus => ({
  subject_name: 'Signali i sistemi',
  subject_id: null,
  semester: 3,
  literature: [
    { title: 'Signals and Systems', authors: 'Oppenheim', required: true },
    { title: 'Signals and Systems (Haykin)', authors: 'Haykin', required: false },
  ],
  topics: [
    { week: 1, name: 'Klasifikacija signala' },
    { week: 2, name: 'LTI sistemi' },
    { week: 3, name: 'LTI  sistemi' },
  ],
  grading: [
    { kind: 'partial', number: 1, title: 'I parcijala', points: 20, pass_points: 10 },
    { kind: 'partial', number: 2, title: 'II parcijala', points: 20, pass_points: 10 },
    { kind: 'final', number: null, title: 'Završni', points: 40, pass_points: 20 },
    { kind: 'attendance', number: null, title: 'Prisustvo', points: 10, pass_points: null },
  ],
  ...over,
})

const existing = {
  sources: [{ subjectId: SIG, title: 'Oppenheim — Signals & Systems' }],
  topics: [{ subjectId: SIG, name: 'Klasifikacija signala' }],
  exams: [
    {
      id: 'p2',
      subjectId: SIG,
      kind: 'partial' as const,
      date: '2026-12-01',
      pointsMax: null,
      passMinPct: null,
    },
    {
      id: 'p1',
      subjectId: SIG,
      kind: 'partial' as const,
      date: '2026-10-28',
      pointsMax: 25,
      passMinPct: null,
    },
    {
      id: 'f',
      subjectId: SIG,
      kind: 'final' as const,
      date: '2027-01-30',
      pointsMax: 40,
      passMinPct: null,
    },
  ],
  pointsTotal: { [SIG]: 100 },
}

describe('proposeSyllabus', () => {
  it('matches the subject and never overwrites what the user entered', () => {
    const [p] = proposeSyllabus([parsed()], [{ id: SIG, name: 'Signali i sistemi' }], existing)
    expect(p!.subjectId).toBe(SIG)
    expect(p!.addSubject).toBe(false)
    // The required book is already there; the extra one is offered but off.
    expect(p!.literature.map((l) => [l.status, l.include])).toEqual([
      ['unchanged', false],
      ['new', false],
    ])
    // Topics: the known one stays, duplicates (spacing) collapse.
    expect(p!.topics.map((t) => [t.name, t.status])).toEqual([
      ['Klasifikacija signala', 'unchanged'],
      ['LTI sistemi', 'new'],
    ])
    expect(p!.grading.map((g) => [g.title, g.existingId, g.status, g.manual, g.include])).toEqual([
      ['I parcijala', 'p1', 'unchanged', true, false], // 25 entered by the user stays
      ['II parcijala', 'p2', 'changed', false, true], // empty points get 20
      ['Završni', 'f', 'unchanged', false, false],
      ['Prisustvo', null, 'unchanged', false, false], // counts in the total only
    ])
    expect(p!.pointsTotal).toEqual({ value: 90, previous: 100, status: 'changed' })
    expect(syllabusSaveCount([p!])).toBe(3) // topic, II parcijala points, total
  })

  it('an unknown subject is offered as new, with everything new', () => {
    const [p] = proposeSyllabus([parsed({ subject_name: 'Numerička analiza' })], [], existing)
    expect(p!.subjectId).toBeNull()
    expect(p!.addSubject).toBe(true)
    expect(p!.grading.filter((g) => g.examKind).every((g) => g.status === 'new')).toBe(true)
    expect(p!.pointsTotal).toEqual({ value: 90, previous: null, status: 'new' })
    // subject + 1 required book + 3 topics... (2 after dedupe) + 3 exams + total
    expect(syllabusSaveCount([p!])).toBe(1 + 1 + 2 + 3 + 1)
    expect(syllabusSaveCount([{ ...p!, addSubject: false }])).toBe(0)
  })

  it('a total the user changed stays', () => {
    const [p] = proposeSyllabus([parsed()], [{ id: SIG, name: 'Signali i sistemi' }], {
      ...existing,
      pointsTotal: { [SIG]: 110 },
    })
    expect(p!.pointsTotal?.status).toBe('unchanged')
  })
})

describe('same title, other author', () => {
  it('Haykin is not Oppenheim even with the same title', () => {
    const [p] = proposeSyllabus(
      [
        parsed({
          literature: [
            { title: 'Signals & Systems', authors: 'Oppenheim', required: true },
            { title: 'Signals and Systems', authors: 'Haykin, Van Veen', required: false },
          ],
        }),
      ],
      [{ id: SIG, name: 'Signali i sistemi' }],
      existing,
    )
    expect(p!.literature.map((l) => l.status)).toEqual(['unchanged', 'new'])
  })
})

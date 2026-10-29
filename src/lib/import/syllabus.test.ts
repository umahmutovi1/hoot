import { describe, expect, it } from 'vitest'
import {
  chapterParts,
  mergeSyllabi,
  pickElective,
  proposeSyllabus,
  syllabusSaveCount,
  type ParsedSyllabus,
} from './syllabus'

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
    // Books are offered but off; the chapters become one "Predavanja" source.
    expect(p!.literature.every((l) => !l.include)).toBe(true)
    expect(p!.chapters?.include).toBe(true)
    // subject + chapters source + 2 topics (after dedupe) + 3 exams + total
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

describe('chapters, electives and parts', () => {
  it('spreads ~25 hour-long parts over the chapters in order', () => {
    const parts = chapterParts(['A', 'B', 'C', 'D'])
    expect(parts).toHaveLength(25)
    expect(parts.filter((x) => x.chapter === 0)).toHaveLength(7)
    expect(parts.filter((x) => x.chapter === 3)).toHaveLength(6)
    expect(parts[0]).toEqual({ chapter: 0, name: 'A', k: 1, n: 7 })
    // More chapters than parts: one each.
    expect(chapterParts(Array.from({ length: 30 }, (_, i) => `T${i}`))).toHaveLength(30)
  })

  it('offers chapters only while the subject has no real source, replacing a rough one', () => {
    const subjects = [{ id: SIG, name: 'Signali i sistemi' }]
    const rough = { ...existing, sources: [{ subjectId: SIG, title: '~25 h', rough: true }] }
    const [p] = proposeSyllabus([parsed()], subjects, rough)
    expect(p!.chapters).toMatchObject({ replacesRough: true, include: true })
    const [q] = proposeSyllabus([parsed()], subjects, existing)
    expect(q!.chapters).toBeNull()
  })

  it('elective options wait for a pick, and one pick per slot', () => {
    const opts = proposeSyllabus(
      [
        parsed({ subject_name: 'Razvoj mobilnih aplikacija', elective_group: 'Izborni 4.1' }),
        parsed({ subject_name: 'Ugradbeni sistemi', elective_group: 'Izborni 4.1' }),
        parsed({ subject_name: 'Računarske arhitekture' }),
      ],
      [],
      existing,
    )
    expect(opts.map((p) => p.addSubject)).toEqual([false, false, true])
    const once = pickElective(opts, opts[0]!.key)
    expect(once.map((p) => p.addSubject)).toEqual([true, false, true])
    const other = pickElective(once, opts[1]!.key)
    expect(other.map((p) => p.addSubject)).toEqual([false, true, true])
  })

  it('merges a subject read in two parts', () => {
    const a = parsed({ topics: [{ week: null, name: 'Uvod' }], grading: [] })
    const b = parsed({
      subject_name: 'SIGNALI I SISTEMI',
      topics: [
        { week: null, name: 'Uvod' },
        { week: null, name: 'Fourier' },
      ],
    })
    const [m, ...rest] = mergeSyllabi([[a], [b, parsed({ subject_name: 'Baze podataka' })]])
    expect(rest).toHaveLength(1)
    expect(m!.topics.map((x) => x.name)).toEqual(['Uvod', 'Fourier'])
    expect(m!.grading).toHaveLength(4)
    expect(m!.literature).toHaveLength(2)
  })
})

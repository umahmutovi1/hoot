import { describe, expect, it } from 'vitest'
import { answerRequest, citationsFor, normalizeParse, parseRequest, toBase64 } from './prompts.ts'
import type { ParseDocumentRequest } from './schemas.ts'

const SIGNALI = '11111111-1111-4111-8111-111111111111'

function request(over: Partial<ParseDocumentRequest> = {}): ParseDocumentRequest {
  return {
    document_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    kind: 'auto',
    locale: 'bs',
    today: '2026-10-20',
    text: [{ page: 1, text: 'Raspored parcijala' }],
    file: null,
    subjects: [{ id: SIGNALI, name: 'Signali i sistemi' }],
    ...over,
  }
}

describe('parseRequest', () => {
  it('logs the task by kind and narrows the schema', () => {
    expect(parseRequest(request({ kind: 'academic_calendar' }), []).task).toBe(
      'parse_academic_calendar',
    )
    expect(parseRequest(request({ kind: 'exam_schedule' }), []).task).toBe('parse_exam_schedule')
    expect(parseRequest(request({ kind: 'document' }), []).task).toBe('parse_document')
    expect(parseRequest(request(), []).task).toBe('parse_document')
  })

  it('sends subjects only where exams are matched', () => {
    expect(parseRequest(request({ kind: 'exam_schedule' }), []).text).toContain(SIGNALI)
    expect(parseRequest(request({ kind: 'academic_calendar' }), []).text).not.toContain(SIGNALI)
  })

  it("passes the student's note before the document, only when given", () => {
    const withNote = parseRequest(request({ note: 'samo II godina' }), [])
    expect(withNote.text).toContain('never invent dates from it):\nsamo II godina\nDocument text:')
    expect(parseRequest(request(), []).text).not.toContain('note about this document')
  })

  it('pages the text and leaves more room when a file must be transcribed', () => {
    const withText = parseRequest(request(), [])
    expect(withText.text).toContain('--- page 1 ---\nRaspored parcijala')
    const withFile = parseRequest(
      request({ text: null, file: { path: 'u/documents/a.jpg', media_type: 'image/jpeg' } }),
      [{ mediaType: 'image/jpeg', base64: 'QQ==' }],
    )
    expect(withFile.maxTokens).toBeGreaterThan(withText.maxTokens)
    expect(withFile.files).toHaveLength(1)
  })
})

describe('normalizeParse', () => {
  const period = { title: 'Rok', starts_on: '2027-01-25', ends_on: '2027-02-12' }

  it('keeps only what matches the recognized kind', () => {
    const result = normalizeParse(request(), {
      kind: 'rules',
      title: 'Pravilnik',
      pages: [],
      warnings: [],
      periods: [{ ...period, kind: 'exam', exam_session: 'regular' }],
      exams: [],
    })
    expect(result).toMatchObject({ kind: 'rules', periods: [], exams: [] })
  })

  it('fixes inconsistent periods and unknown subject ids', () => {
    const calendar = normalizeParse(request({ kind: 'academic_calendar' }), {
      title: 'Kalendar',
      pages: [],
      warnings: [],
      periods: [
        { ...period, kind: 'exam', exam_session: null },
        { ...period, kind: 'holiday', exam_session: 'makeup' },
        { ...period, kind: 'teaching', exam_session: null, ends_on: '2026-01-01' },
      ],
    })
    expect(calendar.kind).toBe('academic_calendar')
    expect(calendar.periods.map((p) => p.exam_session)).toEqual(['regular', null])

    const exams = normalizeParse(request({ kind: 'exam_schedule' }), {
      title: 'Raspored',
      pages: [],
      warnings: [],
      exams: [
        {
          subject_name: 'SiS',
          subject_id: SIGNALI,
          kind: 'partial',
          number: 2,
          date: '2026-12-03',
          time: '09:00',
        },
        {
          subject_name: 'Fizika',
          subject_id: 'made-up',
          kind: 'partial',
          number: 2,
          date: '2026-12-04',
          time: null,
        },
      ],
    })
    expect(exams.exams.map((e) => e.subject_id)).toEqual([SIGNALI, null])
  })

  it('drops a transcription when the text was already given', () => {
    const result = normalizeParse(request({ kind: 'document' }), {
      kind: 'notice',
      title: 'Obavještenje',
      pages: [{ page: 1, text: 'copy' }],
      warnings: [],
    })
    expect(result.pages).toEqual([])
  })
})

describe('answer', () => {
  const passages = [
    { document_id: 'a', title: 'Akademski kalendar', page: 2, content: 'Popravni rok 15.–26. 2.' },
    { document_id: 'b', title: 'Pravilnik', page: 14, content: 'Prijava 7 dana prije' },
    { document_id: 'a', title: 'Akademski kalendar', page: 2, content: 'Druga rečenica' },
  ]
  const req = {
    question: 'Kad je popravni?',
    history: [{ role: 'user' as const, text: 'Zdravo' }],
    state: '{"subjects":[]}',
    locale: 'bs' as const,
    today: '2026-10-20',
  }

  it('puts the state in the cacheable prefix and the question last', () => {
    const r = answerRequest(req, passages)
    expect(r.system).toContain('Bosnian')
    expect(r.prefix).toBe('STATE:\n{"subjects":[]}')
    expect(r.text).not.toContain('STATE:')
    expect(r.text).toContain('[1] Akademski kalendar, page 2')
    expect(r.text).toContain('Student: Zdravo')
    expect(r.text.trim().endsWith('Kad je popravni?')).toBe(true)
  })

  it('cites each used document page once and ignores unknown numbers', () => {
    const citations = citationsFor(
      { answer: 'x', passages: [1, 3, 2, 9], state_refs: [] },
      passages,
    )
    expect(citations).toEqual([
      { document_id: 'a', title: 'Akademski kalendar', page: 2 },
      { document_id: 'b', title: 'Pravilnik', page: 14 },
    ])
  })
})

describe('toBase64', () => {
  it('encodes large inputs in chunks', () => {
    const bytes = new TextEncoder().encode('Hoot'.repeat(20_000))
    expect(atob(toBase64(bytes))).toBe('Hoot'.repeat(20_000))
  })
})

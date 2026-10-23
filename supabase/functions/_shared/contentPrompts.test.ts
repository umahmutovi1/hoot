import { describe, expect, it } from 'vitest'
import {
  linkRequest,
  normalizeLinks,
  normalizeQuestions,
  normalizeToc,
  normalizeTopics,
  questionsRequest,
  tocRequest,
} from './contentPrompts.ts'
import type { ParseQuestionsRequest, ParseTocRequest } from './schemas.ts'
import { parseTocRequestSchema } from './schemas.ts'

function toc(over: Partial<ParseTocRequest> = {}): ParseTocRequest {
  return {
    subject: 'Signali i sistemi',
    locale: 'bs',
    files: [],
    text: '1 Uvod 1\n2 LTI sistemi 74',
    topics: ['Konvolucija', 'Fourierova transformacija'],
    source_kind: 'book',
    measure: 'pages',
    title: 'Oppenheim',
    units: null,
    ...over,
  }
}

const unit = (label: string, over = {}) => ({
  label,
  title: `Naslov ${label}`,
  page_start: 1,
  page_end: null,
  ai_difficulty: 3,
  topics: [],
  ...over,
})

describe('tocRequest', () => {
  it('sends the existing topics and the text', () => {
    const r = tocRequest(toc(), [])
    expect(r.task).toBe('parse_toc')
    expect(r.text).toContain('- Konvolucija')
    expect(r.text).toContain('Table of contents:\n1 Uvod 1')
    expect(r.system).toContain('Never compute it')
  })

  it('rates given units without reading pages', () => {
    const r = tocRequest(toc({ text: null, units: [{ label: '1', title: 'Uvod' }] }), [])
    expect(r.text).toContain('1: Uvod')
    expect(r.system).toContain('The units are given')
  })

  it('points to the files when there is no text', () => {
    const r = tocRequest(toc({ text: null }), [{ mediaType: 'image/jpeg', base64: 'QQ==' }])
    expect(r.text).toContain('attached file')
    expect(r.files).toHaveLength(1)
  })
})

describe('parseTocRequestSchema', () => {
  it('needs files, text or units', () => {
    expect(parseTocRequestSchema.safeParse(toc({ text: '  ' })).success).toBe(false)
    expect(parseTocRequestSchema.safeParse(toc()).success).toBe(true)
  })
})

describe('normalizeToc', () => {
  it('drops repeated labels and reversed ranges, keeps topic spelling', () => {
    const out = normalizeToc(toc(), {
      units: [
        unit('1.', { topics: ['konvolucija', ' Konvolucija ', 'Novo'] }),
        unit('1'),
        unit('2', { page_start: 50, page_end: 40 }),
      ],
      warnings: [],
    })
    expect(out.units.map((u) => u.label)).toEqual(['1', '2'])
    expect(out.units[0]!.topics).toEqual(['Konvolucija', 'Novo'])
    expect(out.units[1]!.page_end).toBeNull()
  })
})

describe('normalizeTopics', () => {
  it('keeps at most three distinct names', () => {
    expect(normalizeTopics(['a', 'b', 'A', 'c', 'd'], [])).toEqual(['a', 'b', 'c'])
  })
})

describe('questions', () => {
  const req: ParseQuestionsRequest = {
    subject: 'Baze',
    locale: 'en',
    files: [],
    text: '1. Šta je 3NF?',
    topics: [],
  }

  it('builds the request', () => {
    const r = questionsRequest(req, [])
    expect(r.task).toBe('parse_questions')
    expect(r.text).toContain('Questions:\n1. Šta je 3NF?')
    expect(r.text).toContain('(none yet)')
  })

  it('numbers labels as P and keeps them unique', () => {
    const out = normalizeQuestions(req, {
      questions: [
        { label: '8.', title: '8. A', topics: [] },
        { label: 'P8', title: 'B', topics: [] },
        { label: '9', title: ' ', topics: [] },
      ],
      warnings: [],
    })
    expect(out.questions.map((q) => q.label)).toEqual(['P8', 'P8-2'])
    expect(out.questions[0]!.title).toBe('A')
  })
})

describe('links', () => {
  const c = (id: string, similarity = 0.8) => ({ id, label: id, title: `T${id}`, similarity })
  const questions = [
    { id: 'q1', text: 'Konvolucija?', candidates: [c('a'), c('b')] },
    { id: 'q2', text: 'DTFT?', candidates: [c('b'), c('c', 0.9)] },
  ]

  it('numbers each chapter once across questions', () => {
    const { request, chapters } = linkRequest('Signali', 'bs', questions)
    expect(chapters).toEqual(['a', 'b', 'c'])
    expect(request.text).toContain('1: Konvolucija? → 1, 2')
    expect(request.text).toContain('2: DTFT? → 2, 3')
  })

  it('keeps only chapters offered to that question', () => {
    const { chapters } = linkRequest('Signali', 'bs', questions)
    const out = normalizeLinks(
      {
        links: [
          { question: 1, chapters: [1, 3] },
          { question: 2, chapters: [3, 3, 2] },
          { question: 7, chapters: [1] },
        ],
      },
      questions,
      chapters,
    )
    expect(out).toEqual([
      { question_id: 'q1', unit_id: 'a', similarity: 0.8 },
      { question_id: 'q2', unit_id: 'c', similarity: 0.9 },
      { question_id: 'q2', unit_id: 'b', similarity: 0.8 },
    ])
  })
})

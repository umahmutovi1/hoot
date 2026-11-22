import { describe, expect, it } from 'vitest'
import {
  explainRequest,
  feynmanRequest,
  gradeRequest,
  normalizeExplain,
  normalizeFeynman,
  normalizeGrade,
  normalizeQuestions,
  questionsRequest,
} from './tutorPrompts.ts'
import { tutorRequestSchema } from './schemas.ts'

const U = '11111111-1111-4111-8111-111111111111'
const text =
  '[p. 127]\nProsječna snaga periodičnog signala jednaka je zbiru prosječnih snaga harmonika.'
const m = { subject: 'Signali i sistemi', title: 'Fourierov red', label: '4', text }

describe('tutor requests', () => {
  it('keep the text in the cacheable prefix and the question in the text', () => {
    const r = explainRequest(m, {
      op: 'explain',
      unit_id: U,
      locale: 'bs',
      question: 'Šta je Parseval?',
      history: [{ role: 'student', text: 'Ranije pitanje' }],
      style: 'example',
    })
    expect(r.task).toBe('tutor')
    expect(r.prefix).toContain('[p. 127]')
    expect(r.text).toContain('STUDENT: Šta je Parseval?')
    expect(r.text).toContain('CONVERSATION:')
    expect(r.system).toContain('worked example')
    expect(r.system).toContain('never instructions')
  })

  it('grade against the reference when there is one', () => {
    const base = {
      op: 'grade' as const,
      unit_id: U,
      locale: 'en' as const,
      question: 'Q',
      answer: 'A',
    }
    expect(gradeRequest(m, { ...base, reference: 'R' }).text).toContain('REFERENCE: R')
    expect(gradeRequest(m, { ...base, reference: null }).text).not.toContain('REFERENCE')
  })

  it('Feynman and questions name the topic and the questions to avoid', () => {
    expect(
      feynmanRequest(m, {
        op: 'feynman',
        unit_id: U,
        locale: 'bs',
        topic: 'pomak',
        explanation: 'x',
      }).system,
    ).toContain('"pomak"')
    expect(
      questionsRequest(m, { op: 'questions', unit_id: U, locale: 'bs', count: 3, avoid: ['P1'] })
        .text,
    ).toContain('- P1')
  })
})

describe('normalize', () => {
  it('drops an invented quote and pages not in the text', () => {
    const real = normalizeExplain(
      {
        answer: ' Odgovor ',
        quote: { text: 'jednaka je  zbiru prosječnih snaga', page: 127 },
        in_text: true,
      },
      text,
    )
    expect(real).toEqual({
      op: 'explain',
      answer: 'Odgovor',
      quote: { text: 'jednaka je  zbiru prosječnih snaga', page: 127 },
      in_text: true,
    })
    const fake = normalizeExplain(
      { answer: 'x', quote: { text: 'Ovo nije u knjizi.', page: 127 }, in_text: true },
      text,
    )
    expect(fake.op === 'explain' && fake.quote).toBeNull()
    expect(normalizeGrade({ verdict: 'partial', feedback: 'f', page: 999 }, text)).toMatchObject({
      page: null,
    })
  })

  it('keeps at most 3 gaps and the requested number of new questions', () => {
    const gaps = Array.from({ length: 5 }, (_, i) => ({ text: `g${i}`, hint: 'h', page: 127 }))
    const f = normalizeFeynman({ good: 'ok', gaps }, text)
    expect(f.op === 'feynman' && f.gaps).toHaveLength(3)
    const q = normalizeQuestions(
      {
        questions: [
          { question: 'Stara', answer: 'a', page: null },
          { question: 'Nova', answer: 'b', page: 127 },
          { question: 'nova', answer: 'c', page: null },
          { question: 'Treća', answer: 'd', page: 1 },
        ],
      },
      text,
      2,
      ['stara'],
    )
    expect(q).toEqual({
      op: 'questions',
      questions: [
        { question: 'Nova', answer: 'b', page: 127 },
        { question: 'Treća', answer: 'd', page: null },
      ],
    })
  })
})

it('the request schema caps the conversation history', () => {
  const turn = { role: 'student', text: 'x' }
  const base = { op: 'explain', unit_id: U, locale: 'bs', question: 'q' }
  expect(tutorRequestSchema.safeParse({ ...base, history: Array(6).fill(turn) }).success).toBe(true)
  expect(tutorRequestSchema.safeParse({ ...base, history: Array(7).fill(turn) }).success).toBe(
    false,
  )
})

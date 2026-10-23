import { describe, expect, it } from 'vitest'
import { normalizeRecall, proposeAnswerRequest, recallRequest } from './recallPrompts.ts'
import { recallQuestionsRequestSchema } from './schemas.ts'

const material = {
  subject: 'Baze podataka',
  title: 'Funkcionalne zavisnosti',
  label: '5.1',
  subheadings: ['5.1.1 Armstrongovi aksiomi'],
  notes: 'X → Y je trivijalna kada je Y ⊆ X.',
}

describe('recallRequest', () => {
  it('sends the notes only for notes questions', () => {
    const notes = recallRequest(material, 'notes', 3, 'bs', [])
    expect(notes.task).toBe('recall_questions')
    expect(notes.text).toContain('NOTES:\nX → Y')
    expect(notes.system).toContain('Use ONLY the student')
    const general = recallRequest(material, 'general', 6, 'en', [])
    expect(general.text).not.toContain('NOTES')
    expect(general.text).toContain('- 5.1.1 Armstrongovi aksiomi')
    expect(general.system).toContain('Write 6 short questions in English')
  })

  it('points to the photo for page questions', () => {
    const r = recallRequest(material, 'page_photo', 3, 'bs', [
      { mediaType: 'image/jpeg', base64: 'QQ==' },
    ])
    expect(r.text).toContain('attached photo')
    expect(r.files).toHaveLength(1)
  })
})

describe('normalizeRecall', () => {
  it('drops empty pairs and caps the count', () => {
    const out = normalizeRecall(
      {
        questions: [
          { question: ' A? ', answer: ' a ' },
          { question: 'B?', answer: ' ' },
          { question: 'C?', answer: 'c' },
          { question: 'D?', answer: 'd' },
        ],
      },
      2,
    )
    expect(out).toEqual([
      { question: 'A?', answer: 'a' },
      { question: 'C?', answer: 'c' },
    ])
  })
})

describe('recallQuestionsRequestSchema', () => {
  const base = {
    unit_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    count: 3,
    locale: 'bs',
    files: [],
  }
  it('needs photos exactly for page questions', () => {
    expect(recallQuestionsRequestSchema.safeParse({ ...base, source: 'notes' }).success).toBe(true)
    expect(recallQuestionsRequestSchema.safeParse({ ...base, source: 'page_photo' }).success).toBe(
      false,
    )
  })
})

describe('proposeAnswerRequest', () => {
  it('lists the linked chapters with their notes', () => {
    const r = proposeAnswerRequest(
      {
        subject: 'Baze',
        question: 'Razlika 3NF i BCNF?',
        chapters: [
          { title: 'Normalizacija', notes: 'BCNF je stroža.' },
          { title: 'Ključevi', notes: null },
        ],
      },
      'bs',
    )
    expect(r.task).toBe('propose_answer')
    expect(r.text).toContain('Chapter: Normalizacija\nNotes:\nBCNF je stroža.\nChapter: Ključevi')
  })
})

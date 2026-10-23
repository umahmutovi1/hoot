import { describe, expect, it } from 'vitest'
import { chaptersByQuestion, questionsByChapter, type LinkUnit } from './links'

const units: LinkUnit[] = [
  { id: 'c1', kind: 'chapter' },
  { id: 'c2', kind: 'chapter' },
  { id: 'q1', kind: 'question' },
  { id: 'q2', kind: 'question' },
]

describe('questionsByChapter', () => {
  it('links through shared topics', () => {
    const out = questionsByChapter(
      units,
      [
        { unit_id: 'c1', topic_id: 't' },
        { unit_id: 'q1', topic_id: 't' },
        { unit_id: 'q2', topic_id: 'other' },
      ],
      [],
    )
    expect([...(out.get('c1') ?? [])]).toEqual(['q1'])
    expect(out.has('c2')).toBe(false)
  })

  it('adds direct links and lets a rejection win over a topic', () => {
    const out = questionsByChapter(
      units,
      [
        { unit_id: 'c1', topic_id: 't' },
        { unit_id: 'q1', topic_id: 't' },
      ],
      [
        { question_id: 'q2', unit_id: 'c2', linked: true },
        { question_id: 'q1', unit_id: 'c1', linked: false },
      ],
    )
    expect([...(out.get('c1') ?? [])]).toEqual([])
    expect([...(out.get('c2') ?? [])]).toEqual(['q2'])
    expect([...(chaptersByQuestion(out).get('q2') ?? [])]).toEqual(['c2'])
  })

  it('ignores links of unknown units and question-to-question links', () => {
    const out = questionsByChapter(
      units,
      [],
      [
        { question_id: 'q1', unit_id: 'q2', linked: true },
        { question_id: 'gone', unit_id: 'c1', linked: true },
      ],
    )
    expect(out.size).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { checkReviews } from '@/features/review/check'
import { card, unit } from '@/features/review/fixtures'
import { leafOfPage, missing, ROUND_SIZE, roundItems, textItems } from './round'

const a = unit('a', { page_start: 112, page_end: 120 })
const b = unit('b', { page_start: 121, page_end: 131 })
const q = unit('q22', { kind: 'question', title: 'Koeficijenti impulsa?', answer: 'sinc' })

describe('tutor round', () => {
  it('asks exam questions first, then the chapter cards with the due ones first', () => {
    const later = { ...card('c1', 'b'), next_review_on: '2026-12-01' }
    const due = { ...card('c2', 'a'), next_review_on: '2026-11-20' }
    const other = card('c3', 'zzz')
    const items = roundItems([a, b], [q], [later, due, other], '2026-11-22')
    expect(items.map((i) => i.key)).toEqual(['q:q22', 'c:c2', 'c:c1'])
    expect(items[2]!.unit.id).toBe('b')
  })

  it('caps the round and fills the rest from the text only when there is text', () => {
    const cards = Array.from({ length: 9 }, (_, i) => card(`c${i}`, 'a'))
    expect(roundItems([a], [], cards, '2026-11-22')).toHaveLength(ROUND_SIZE)
    const two = roundItems([a], [q], [card('c1', 'a')], '2026-11-22')
    expect(missing(two, true)).toBe(4)
    expect(missing(two, false)).toBe(0)
  })

  it('a question from the text rates the leaf its page is in', () => {
    expect(leafOfPage([a, b], 125).id).toBe('b')
    expect(leafOfPage([a, b], null).id).toBe('a')
    expect(leafOfPage([a, b], 999).id).toBe('a')
    const [item] = textItems([a, b], [{ question: 'Parseval?', answer: 'snaga', page: 127 }])
    expect(item!.unit.id).toBe('b')
    const reviews = checkReviews([item!], { [item!.key]: 2 })
    expect(reviews.units[0]!.recalls).toEqual([{ recall: 2, source: 'source_text' }])
  })

  it('an exam question also reviews the question itself', () => {
    const items = roundItems([a], [q], [], '2026-11-22')
    const reviews = checkReviews(items, { 'q:q22': 1 })
    expect(reviews.units.map((u) => [u.unit.id, u.recalls[0]!.source])).toEqual([
      ['a', 'exam_question'],
      ['q22', 'exam_question'],
    ])
  })
})

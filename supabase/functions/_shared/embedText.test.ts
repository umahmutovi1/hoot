import { describe, expect, it } from 'vitest'
import { EMBED_TEXT_CHARS, embedText, rankNotes, takeByBudget } from './embedText.ts'

describe('embedText', () => {
  it('joins the non-empty parts', () => {
    expect(embedText({ kind: 'unit', id: 'a', parts: ['  Konvolucija ', null, ' '] })).toBe(
      'Konvolucija',
    )
    expect(embedText({ kind: 'card', id: 'a', parts: ['Q', 'A'] })).toBe('Q\nA')
  })

  it('caps long notes', () => {
    const text = embedText({ kind: 'unit', id: 'a', parts: ['T', 'x'.repeat(5000)] })
    expect(text).toHaveLength(EMBED_TEXT_CHARS)
  })
})

describe('takeByBudget', () => {
  it('stops before the budget is exceeded', () => {
    expect(takeByBudget([800, 800, 800], (n) => n, 2000)).toEqual([800, 800])
  })

  it('always takes the first row', () => {
    expect(takeByBudget([3000, 10], (n) => n, 2000)).toEqual([3000])
    expect(takeByBudget([], (n: number) => n)).toEqual([])
  })
})

describe('rankNotes', () => {
  const hits = [
    { id: 'n', similarity: 0.84, text: 'Normalizacija: 1NF, 2NF, 3NF, BCNF. Normalne forme…' },
    { id: 'f', similarity: 0.83, text: 'Fourierova transformacija. Konvolucija u vremenu…' },
  ]

  it('keeps hits that share a stem with the query, those first', () => {
    expect(rankNotes('gdje sam pisala o konvoluciji', hits).map((h) => h.id)).toEqual(['f'])
    expect(rankNotes('normalne forme', hits).map((h) => h.id)).toEqual(['n'])
  })

  it('drops unrelated hits unless they are nearly identical', () => {
    expect(rankNotes('recept za palačinke', hits)).toEqual([])
    expect(rankNotes('xyz', [{ id: 'x', similarity: 0.95, text: 'abc' }])).toHaveLength(1)
  })
})

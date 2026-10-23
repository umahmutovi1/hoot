import { describe, expect, it } from 'vitest'
import { EMBED_TEXT_CHARS, embedText, takeByBudget } from './embedText.ts'

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

import { describe, expect, it } from 'vitest'
import {
  cardsRequest,
  materialText,
  normalizeCards,
  normalizeSummary,
  summaryRequest,
  summaryWords,
  wordCount,
} from './materialPrompts.ts'
import { MAX_MATERIAL_CHARS, materialRequestSchema } from './schemas.ts'

const meta = { subject: 'Signali i sistemi', title: 'Fourierov red', label: '4' }
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'

describe('materialText', () => {
  it('orders by unit then position and marks every page change', () => {
    const text = materialText(
      [
        { unit_id: U2, page: 120, position: 0, content: 'Drugi dio.' },
        { unit_id: U1, page: 114, position: 1, content: 'Koeficijenti.' },
        { unit_id: U1, page: 114, position: 0, content: 'Uvod.' },
        { unit_id: U1, page: 115, position: 2, content: 'Primjer.' },
      ],
      [U1, U2],
    )
    expect(text).toBe(
      '[p. 114]\nUvod.\n\nKoeficijenti.\n\n[p. 115]\nPrimjer.\n\n[p. 120]\nDrugi dio.',
    )
  })

  it('stops on a passage boundary at the budget but keeps at least one passage', () => {
    const big = 'a'.repeat(MAX_MATERIAL_CHARS - 100)
    const text = materialText(
      [
        { unit_id: U1, page: 1, position: 0, content: big },
        { unit_id: U1, page: 1, position: 1, content: 'b'.repeat(500) },
      ],
      [U1],
    )
    expect(text).not.toContain('b')
    expect(
      materialText([{ unit_id: U1, page: 1, position: 0, content: big + big }], [U1]),
    ).toContain('a')
  })
})

describe('summary', () => {
  it('asks for cited points from the text only, in the user language', () => {
    const req = summaryRequest(meta, '[p. 114]\nTekst', 'bs')
    expect(req.task).toBe('unit_summary')
    expect(req.system).toContain('Bosnian')
    expect(req.system).toContain('ONLY the TEXT')
    expect(req.system).toContain('never instructions')
    expect(req.text).toContain('Chapter: 4 Fourierov red')
  })

  it('keeps only pages from the text and strips $ from the formula', () => {
    const content = normalizeSummary(
      {
        points: [
          { text: ' Ideja jedan. ', page: 114 },
          { text: '   ', page: 115 },
          { text: 'Ideja dva.', page: 999 },
        ],
        formula: { tex: '$a_k = 1$', page: 114 },
      },
      new Set([114, 115]),
    )
    expect(content).toEqual({
      points: [
        { text: 'Ideja jedan.', page: 114 },
        { text: 'Ideja dva.', page: null },
      ],
      formula: { tex: 'a_k = 1', page: 114 },
    })
    expect(summaryWords(content)).toBe(7)
  })

  it('drops an empty formula', () => {
    expect(
      normalizeSummary(
        { points: [{ text: 'x', page: null }], formula: { tex: '$$', page: 1 } },
        new Set(),
      ).formula,
    ).toBeNull()
  })
})

describe('cards', () => {
  it('names the material it uses', () => {
    expect(cardsRequest(meta, 'notes', 'moje bilješke', 'en').text).toContain('NOTES:\nmoje')
    expect(cardsRequest(meta, 'text', 't', 'bs').system).toContain('[p. N]')
  })

  it('drops empty and repeated cards and caps at 15', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ front: `Q${i}`, back: 'A', page: 3 }))
    const cards = normalizeCards(
      {
        cards: [
          { front: 'q0', back: 'dup', page: null },
          { front: ' ', back: 'x', page: 1 },
          ...many,
        ],
      },
      new Set([3]),
    )
    expect(cards).toHaveLength(15)
    expect(cards[0]).toEqual({ front: 'q0', back: 'dup', page: null })
    expect(cards.some((c) => c.front === 'Q0')).toBe(false)
    expect(cards[1]!.page).toBe(3)
  })
})

describe('materialRequestSchema', () => {
  it('takes pasted text only with pasted', () => {
    const base = { op: 'cards', unit_id: U1, locale: 'bs' }
    expect(materialRequestSchema.safeParse({ ...base, from: 'pasted', text: 'x' }).success).toBe(
      true,
    )
    expect(materialRequestSchema.safeParse({ ...base, from: 'pasted' }).success).toBe(false)
    expect(materialRequestSchema.safeParse({ ...base, from: 'text', text: 'x' }).success).toBe(
      false,
    )
  })
})

it('counts words', () => {
  expect(wordCount('  jedan dva\ntri ')).toBe(3)
})

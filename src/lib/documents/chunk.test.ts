import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { chunkPages } from './chunk'

describe('chunkPages', () => {
  it('keeps short paragraphs together and numbers chunks across pages', () => {
    const chunks = chunkPages([
      { page: 1, text: 'Član 1.\n\nČlan 2.' },
      { page: 2, text: 'Član 3.' },
      { page: 3, text: '   ' },
    ])
    expect(chunks).toEqual([
      { page: 1, position: 0, content: 'Član 1.\nČlan 2.' },
      { page: 2, position: 1, content: 'Član 3.' },
    ])
  })

  it('splits long paragraphs at sentence ends', () => {
    const sentence = 'Student ima pravo na popravni ispit u roku. '
    const chunks = chunkPages([{ page: 4, text: sentence.repeat(60) }], 300)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(300)
      expect(c.content.endsWith('.')).toBe(true)
    }
  })

  it('never loses words, never crosses a page and respects the size', () => {
    const word = fc.stringMatching(/^[a-zčćšđž]{1,12}$/)
    const text = fc.array(fc.array(word, { minLength: 1, maxLength: 80 }), { maxLength: 6 })
    fc.assert(
      fc.property(
        fc.array(text, { minLength: 1, maxLength: 4 }),
        fc.integer({ min: 40, max: 400 }),
        (pages, max) => {
          const input = pages.map((paras, i) => ({
            page: i + 1,
            text: paras.map((p) => p.join(' ')).join('\n\n'),
          }))
          const chunks = chunkPages(input, max)
          chunks.forEach((c, i) => {
            expect(c.position).toBe(i)
            expect(c.content.length).toBeLessThanOrEqual(max)
          })
          for (const { page, text: t } of input) {
            const words = t.split(/\s+/).filter(Boolean)
            const got = chunks
              .filter((c) => c.page === page)
              .flatMap((c) => c.content.split(/\s+/).filter(Boolean))
            expect(got).toEqual(words)
          }
        },
      ),
    )
  })
})

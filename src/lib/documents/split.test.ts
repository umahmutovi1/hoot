import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { splitPages } from './split'

const page = (n: number, len: number) => ({ page: n, text: 'x'.repeat(len) })

describe('splitPages', () => {
  it('keeps a short document in one part', () => {
    expect(splitPages([page(1, 10), page(2, 10)], 100, 5)).toEqual([[page(1, 10), page(2, 10)]])
  })

  it('cuts between pages and repeats the last page of a part', () => {
    const parts = splitPages([page(1, 40), page(2, 40), page(3, 40), page(4, 40)], 100, 5)
    expect(parts.map((p) => p.map((x) => x.page))).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ])
  })

  it('stops at the part limit', () => {
    const pages = Array.from({ length: 10 }, (_, i) => page(i + 1, 60))
    expect(splitPages(pages, 100, 3)).toHaveLength(3)
  })

  it('every part fits, and every page is read when the limit allows', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 150 }), { maxLength: 40 }), (lens) => {
        const pages = lens.map((len, i) => page(i + 1, len))
        const parts = splitPages(pages, 100, 1000)
        for (const part of parts)
          expect(part.reduce((n, p) => n + p.text.length, 0)).toBeLessThanOrEqual(100)
        const read = new Set(parts.flat().map((p) => p.page))
        expect(read.size).toBe(pages.length)
      }),
    )
  })
})

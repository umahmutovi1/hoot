import { describe, expect, it } from 'vitest'
import { fromAi } from './ai'
import { filesAsUnits, findTocPages, offsetFromLabels, pdfOutlineUnits } from './pdf'

describe('pdfOutlineUnits', () => {
  const items = [
    { title: 'Contents', depth: 0, page: 5 },
    { title: '1 Signals and Systems', depth: 0, page: 25 },
    { title: '1.1 Continuous and discrete signals', depth: 1, page: 25 },
    { title: '1.2 Transformations', depth: 1, page: 38 },
    { title: 'Chapter 2: Linear Time-Invariant Systems', depth: 0, page: 98 },
    { title: 'Convolution sum', depth: 1, page: 99 },
    { title: 'A very deep note', depth: 4, page: 100 },
    { title: 'Index', depth: 0, page: 950 },
  ]

  it('keeps numbers as labels, numbers the rest by position, skips front matter', () => {
    const units = pdfOutlineUnits(items, 957, 24)
    expect(units.map((u) => [u.label, u.title, u.page_start, u.page_end])).toEqual([
      ['1', 'Signals and Systems', 1, null],
      ['1.1', 'Continuous and discrete signals', 1, null],
      ['1.2', 'Transformations', 14, null],
      // The last unit and the units it sits in end on the last page.
      ['2', 'Linear Time-Invariant Systems', 74, 933],
      ['2.1', 'Convolution sum', 75, 933],
      ['2.1.1', 'A very deep note', 76, 933],
    ])
  })

  it('goes through the same parser as AI import (ends from the next start)', () => {
    const { outline } = fromAi(pdfOutlineUnits(items.slice(0, 6), 200, 24), 'pages')
    expect(outline.units.map((u) => [u.label, u.depth, u.pageStart, u.pageEnd])).toEqual([
      ['1', 0, 1, 73],
      ['1.1', 1, 1, 13],
      ['1.2', 1, 14, 73],
      ['2', 0, 74, 176],
      ['2.1', 1, 75, 176],
    ])
  })

  it('a bookmark without a page keeps its place, without pages', () => {
    const units = pdfOutlineUnits(
      [
        { title: 'Part I', depth: 0, page: null },
        { title: 'Intro', depth: 1, page: 3 },
      ],
      10,
    )
    expect(units.map((u) => [u.label, u.page_start, u.page_end])).toEqual([
      ['1', null, null],
      ['1.1', 3, 10],
    ])
  })
})

describe('offsetFromLabels', () => {
  it('is the index of the page labelled 1', () => {
    expect(offsetFromLabels(['i', 'ii', 'iii', '1', '2'])).toBe(3)
    expect(offsetFromLabels(['1', '2'])).toBe(0)
    expect(offsetFromLabels(null)).toBe(0)
  })
})

describe('findTocPages', () => {
  const toc = (n: number) => ({
    page: n,
    text: ['2.1 Konvolucija .... 75', '2.2 Svojstva 80', '3 Fourier 97', '3.1 Red 98'].join('\n'),
  })
  it('the titled page and the toc-like pages right after it', () => {
    expect(
      findTocPages([
        { page: 1, text: 'Naslov' },
        { page: 2, text: 'Sadržaj\n1 Uvod 1\n2 LTI 74' },
        toc(3),
        { page: 4, text: 'Predgovor\nOva knjiga je nastala iz predavanja.' },
        toc(5),
      ]),
    ).toEqual({ from: 2, to: 3 })
  })
  it('none without a title in the first 20 pages', () => {
    expect(findTocPages([toc(1), toc(2)])).toBeNull()
  })
})

describe('filesAsUnits', () => {
  it('one unit per file in natural name order, pages one after another', () => {
    expect(
      filesAsUnits([
        { name: 'P10-Z.pdf', pages: 5 },
        { name: 'P2-LTI.pdf', pages: 30 },
        { name: 'P1_Uvod.pdf', pages: 12 },
      ]).map((u) => [u.label, u.title, u.page_start, u.page_end]),
    ).toEqual([
      ['L1', 'P1 Uvod', 1, 12],
      ['L2', 'P2-LTI', 13, 42],
      ['L3', 'P10-Z', 43, 47],
    ])
  })
})

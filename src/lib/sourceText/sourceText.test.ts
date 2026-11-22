import { describe, expect, it } from 'vitest'
import { coverage, offsetFromPageLabels, pageOffset, unitChunks, unitRanges } from '.'
import type { TextUnit } from '.'

const units: TextUnit[] = [
  { id: 'a', title: '1 Uvod u signale', pageStart: 1, pageEnd: null },
  { id: 'b', title: '2 Linearni sistemi', pageStart: 3, pageEnd: null },
  { id: 'c', title: '3 Fourierov red', pageStart: 5, pageEnd: 6 },
]
// Two pages of front matter: book page 1 is PDF page 3.
const pages = [
  { page: 1, text: 'Sadržaj' },
  { page: 2, text: 'Predgovor' },
  { page: 3, text: '1 Uvod u signale\nSignal je funkcija.' },
  { page: 4, text: 'Primjeri signala.' },
  { page: 5, text: '2 Linearni sistemi\nSistem je linearan.' },
  { page: 6, text: 'Superpozicija.' },
  { page: 7, text: '3 Fourierov red\nPeriodični signal.' },
  { page: 8, text: 'Koeficijenti.' },
]

describe('pageOffset', () => {
  it('reads the offset from the page labels', () => {
    expect(offsetFromPageLabels(['i', 'ii', '1', '2'])).toBe(2)
    expect(offsetFromPageLabels(null)).toBeNull()
    expect(pageOffset([], units, ['i', '1'])).toEqual({ offset: 1, sure: true })
  })

  it('finds the offset under which unit titles are on their first page', () => {
    expect(pageOffset(pages, units)).toEqual({ offset: 2, sure: true })
  })

  it('is not sure when no title is found', () => {
    expect(pageOffset([{ page: 1, text: 'x' }], units)).toEqual({ offset: 0, sure: false })
  })
})

describe('unitRanges', () => {
  it('ends a unit before the next one starts, keeps an explicit end', () => {
    expect([...unitRanges(units)]).toEqual([
      ['a', { from: 1, to: 2 }],
      ['b', { from: 3, to: 4 }],
      ['c', { from: 5, to: 6 }],
    ])
  })

  it('skips units without a first page', () => {
    expect(unitRanges([{ id: 'x', title: 'X', pageStart: null, pageEnd: null }]).size).toBe(0)
  })
})

describe('unitChunks', () => {
  it('gives each unit the text of its book pages with book page numbers', () => {
    const chunks = unitChunks(pages, units, 2)
    expect(chunks.filter((c) => c.unitId === 'a').map((c) => [c.page, c.content])).toEqual([
      [1, '1 Uvod u signale\nSignal je funkcija.'],
      [2, 'Primjeri signala.'],
    ])
    expect(chunks.find((c) => c.unitId === 'c')?.page).toBe(5)
    expect(coverage(chunks)).toEqual({ units: 3, pages: 6 })
  })

  it('numbers passages per unit from 0', () => {
    const chunks = unitChunks(pages, units, 2)
    expect(chunks.filter((c) => c.unitId === 'b').map((c) => c.position)).toEqual([0, 1])
  })
})

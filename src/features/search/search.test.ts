import { describe, expect, it } from 'vitest'
import { addRecent, createSearcher, highlight, type SearchEntry } from './search'

const entries: SearchEntry[] = [
  {
    id: 'more',
    group: 'actions',
    title: 'Više vremena ovaj dan',
    keywords: ['dodatno vrijeme', 'produži dan'],
    to: '/plan?more=1',
  },
  {
    id: 'availability',
    group: 'settings',
    title: 'Dostupnost',
    keywords: ['više vremena', 'sati', 'kad učim'],
    to: '/plan/availability',
  },
  { id: 'presets', group: 'settings', title: 'Predlošci sesije', keywords: ['pauze'], to: '/s' },
  { id: 'u1', group: 'units', title: '3.2 Fourierova transformacija', keywords: [], to: '/u1' },
  { id: 's1', group: 'subjects', title: 'Signali i sistemi', keywords: [], to: '/s1' },
]
const search = createSearcher(entries)

describe('search', () => {
  it('finds by title and by synonym, grouped in the fixed group order', () => {
    const r = search('više vr')
    expect(r.map((g) => g.group)).toEqual(['actions', 'settings'])
    expect(r[0]!.hits[0]!.entry.id).toBe('more')
    expect(search('pauze')[0]!.hits[0]!.entry.id).toBe('presets')
  })

  it('ignores diacritics and case', () => {
    expect(search('VISE VREMENA')[0]!.hits[0]!.entry.id).toBe('more')
    expect(search('fourier')[0]!.group).toBe('units')
  })

  it('needs two characters and returns nothing for nonsense', () => {
    expect(search('f')).toEqual([])
    expect(search('kvantna')).toEqual([])
  })

  it('highlights matched ranges of the title', () => {
    const hit = search('fourier')[0]!.hits[0]!
    const parts = highlight(hit.entry.title, hit.ranges)
    expect(parts.filter((p) => p.match).map((p) => p.text.toLowerCase())).toContain('fourier')
    expect(parts.map((p) => p.text).join('')).toBe(hit.entry.title)
  })

  it('keeps six recent queries, newest first, without duplicates', () => {
    let list: string[] = []
    for (const q of ['a1', 'a2', 'A1', 'a3', 'a4', 'a5', 'a6', 'a7']) list = addRecent(list, q)
    expect(list).toEqual(['a7', 'a6', 'a5', 'a4', 'a3', 'A1'])
    expect(addRecent(list, '  ')).toBe(list)
  })
})

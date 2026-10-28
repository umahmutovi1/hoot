import { describe, expect, it } from 'vitest'
import { normalizeLink, splitLink } from './link'

describe('links in typed text', () => {
  it('finds the link and keeps the rest as the note', () => {
    expect(
      splitLink('Pročitaj ovo: https://etf.unsa.ba/uploads/plan.pdf, samo 2. godina.'),
    ).toEqual({
      url: 'https://etf.unsa.ba/uploads/plan.pdf',
      rest: 'Pročitaj ovo: , samo 2. godina.',
    })
  })

  it('takes www. addresses and drops the closing punctuation', () => {
    expect(splitLink('(www.pmf.unsa.ba/kalendar)')?.url).toBe('https://www.pmf.unsa.ba/kalendar')
  })

  it('is null without a link', () => {
    expect(splitLink('Kad je ispit iz Signala?')).toBeNull()
  })

  it('adds https:// and rejects single-label hosts', () => {
    expect(normalizeLink('etf.unsa.ba/x')).toBe('https://etf.unsa.ba/x')
    expect(normalizeLink('http://etf.unsa.ba')).toBe('http://etf.unsa.ba/')
    expect(normalizeLink('localhost:3000')).toBeNull()
    expect(normalizeLink('nije link')).toBeNull()
  })
})

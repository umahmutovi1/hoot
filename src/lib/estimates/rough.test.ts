import { describe, expect, it } from 'vitest'
import { otherRough, ROUGH_HOURS, roughSource, roughToArchive, sameBook } from './rough'

describe('roughSource', () => {
  it('splits the hours into hour-long parts of an "Ostalo" source', () => {
    expect(roughSource('medium')).toEqual({
      kind: 'other',
      measure: 'items',
      baseMinPerUnit: 60,
      parts: 25,
    })
    expect(roughSource('small').parts * 60).toBe(ROUGH_HOURS.small * 60)
    expect(roughSource('large').parts).toBe(45)
  })
})

describe('roughToArchive', () => {
  const list = [
    { id: 'est', is_rough: true, title: 'Gruba procjena · ~25 h' },
    { id: 'opp', is_rough: true, title: 'Oppenheim, Signals and Systems' },
    { id: 'hay', is_rough: true, title: 'Haykin – Communication Systems' },
    { id: 'book', is_rough: false, title: 'Oppenheim, Signals and Systems' },
  ]

  it('archives only the rough source of the same book', () => {
    expect(roughToArchive(list, 'Signals and Systems').map((s) => s.id)).toEqual(['opp'])
    expect(roughToArchive(list, 'Skripta iz signala')).toEqual([])
  })

  it('offers the other rough sources', () => {
    expect(otherRough(list, 'Signals and Systems').map((s) => s.id)).toEqual(['est', 'hay'])
  })

  it('compares titles without case, diacritics and punctuation', () => {
    expect(sameBook('Signali i sistemi', 'SIGNALI I SISTEMI!')).toBe(true)
    expect(sameBook('Osnove elektrotehnike', 'Elektronika')).toBe(false)
    expect(sameBook('Č', 'c')).toBe(true)
  })
})

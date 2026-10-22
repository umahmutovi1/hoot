import { describe, expect, it } from 'vitest'
import { ROUGH_HOURS, roughSource, roughToArchive } from './rough'

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
  it('keeps the rough source while it is the only one', () => {
    expect(roughToArchive([{ id: 'r', is_rough: true }])).toEqual([])
  })

  it('archives it as soon as real content exists', () => {
    const list = [
      { id: 'r', is_rough: true },
      { id: 'book', is_rough: false },
    ]
    expect(roughToArchive(list).map((s) => s.id)).toEqual(['r'])
  })
})

import { describe, expect, it } from 'vitest'
import { findChapter } from './findChapter'

const chapters = [
  { id: 'a', label: '2', title: 'LTI sistemi' },
  { id: 'b', label: '4', title: 'Fourierova transformacija' },
  { id: 'c', label: '4.1', title: 'Predstavljanje aperiodičnih signala' },
]

describe('findChapter', () => {
  it('matches a label first, then the title', () => {
    expect(findChapter('poglavlje 4', chapters)?.id).toBe('b')
    expect(findChapter('4.1', chapters)?.id).toBe('c')
    expect(findChapter('Furijeova transformacija', chapters)?.id).toBe('b')
    expect(findChapter('aperiodicni signali', chapters)?.id).toBe('c')
  })

  it('is null when nothing is close', () => {
    expect(findChapter('Baze podataka', chapters)).toBeNull()
    expect(findChapter('poglavlje', chapters)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { cosine, matchTopics, topicKey, unmatchedNames } from './dedupe'

const known = [
  { id: 'ft', name: 'Fourierova transformacija', vector: [1, 0, 0] },
  { id: 'kv', name: 'Konvolucija', vector: null },
]

describe('topic dedupe', () => {
  it('matches exact names ignoring case and spaces', () => {
    expect(topicKey('  Fourierova   TRANSFORMACIJA ')).toBe('fourierova transformacija')
    expect(unmatchedNames(['konvolucija', 'DTFT', 'dtft '], known)).toEqual(['DTFT'])
  })

  it('maps near-identical vectors to the existing topic and keeps the rest new', () => {
    const vectors = new Map([
      ['fourierove transformacije', [0.99, 0.1, 0]],
      ['dtft', [0, 1, 0]],
    ])
    const out = matchTopics(
      ['Fourierove transformacije', 'DTFT', 'konvolucija', 'DTFT'],
      known,
      vectors,
    )
    expect(out.get('fourierove transformacije')).toBe('ft')
    expect(out.get('dtft')).toBeNull()
    expect(out.get('konvolucija')).toBe('kv')
    expect(out.size).toBe(3)
  })

  it('cosine of orthogonal and equal vectors', () => {
    expect(cosine([1, 0], [0, 1])).toBe(0)
    expect(cosine([2, 0], [1, 0])).toBe(1)
  })
})

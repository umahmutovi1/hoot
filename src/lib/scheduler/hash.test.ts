import { describe, expect, it } from 'vitest'
import { canonicalJson, hashString, inputHash, seededRandom, seedOf } from '.'

describe('input hash', () => {
  it('ignores object key order and undefined fields', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: undefined }] })).toBe('{"a":[2,{"d":3}],"b":1}')
    expect(inputHash({ a: 1, b: 2 })).toBe(inputHash({ b: 2, a: 1 }))
  })

  it('is 32 hex characters and changes with the input', () => {
    expect(hashString('hoot')).toMatch(/^[0-9a-f]{32}$/)
    expect(inputHash({ a: 1 })).not.toBe(inputHash({ a: 2 }))
    expect(inputHash([1, 2])).not.toBe(inputHash([2, 1]))
  })

  it('seeds the same random sequence from the same hash', () => {
    const h = inputHash({ plan: 1 })
    const a = seededRandom(seedOf(h))
    const b = seededRandom(seedOf(h))
    const xs = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(xs)
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true)
  })
})

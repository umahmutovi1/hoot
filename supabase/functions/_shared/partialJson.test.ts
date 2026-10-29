import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { partialStringField } from './partialJson'

describe('partialStringField', () => {
  it('reads the value written so far', () => {
    expect(partialStringField('{"answer": "Ispit je u pe', 'answer')).toBe('Ispit je u pe')
    expect(partialStringField('{"answer":"Gotovo.","passages":[1]}', 'answer')).toBe('Gotovo.')
  })

  it('is null before the value starts', () => {
    expect(partialStringField('{"answ', 'answer')).toBeNull()
    expect(partialStringField('{"answer": ', 'answer')).toBeNull()
  })

  it('decodes escapes and waits for a cut-off one', () => {
    expect(partialStringField('{"answer":"a\\nb \\"c\\" \\u0161', 'answer')).toBe('a\nb "c" š')
    expect(partialStringField('{"answer":"a\\', 'answer')).toBe('a')
    expect(partialStringField('{"answer":"a\\u01', 'answer')).toBe('a')
  })

  it('every prefix of an encoded string is a prefix of the value', () => {
    fc.assert(
      fc.property(fc.string(), fc.nat(), (value, cut) => {
        const json = JSON.stringify({ answer: value, passages: [] })
        const full = partialStringField(json, 'answer')
        expect(full).toBe(value)
        const part = partialStringField(json.slice(0, cut % (json.length + 1)), 'answer')
        if (part !== null) expect(value.startsWith(part)).toBe(true)
      }),
    )
  })
})

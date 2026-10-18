import { describe, expect, it } from 'vitest'
import { greetingPart } from './greeting'

describe('greetingPart', () => {
  it.each([
    [4, 'morning'],
    [11, 'morning'],
    [12, 'day'],
    [17, 'day'],
    [18, 'evening'],
    [23, 'evening'],
    [0, 'evening'],
    [3, 'evening'],
  ] as const)('hour %i → %s', (hour, expected) => {
    expect(greetingPart(hour)).toBe(expected)
  })
})

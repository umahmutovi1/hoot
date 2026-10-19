import { describe, expect, it } from 'vitest'
import { validationKey } from './validation'

describe('validationKey', () => {
  it('passes through validation keys', () => {
    expect(validationKey('validation.tooLong')).toBe('validation.tooLong')
  })

  it('falls back for missing or foreign messages', () => {
    expect(validationKey(undefined)).toBe('validation.required')
    expect(validationKey('Too small: expected string to have >=1 characters')).toBe(
      'validation.required',
    )
  })
})

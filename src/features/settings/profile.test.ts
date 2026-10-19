import { describe, expect, it } from 'vitest'
import { displayNameSchema } from './profile'

describe('displayNameSchema', () => {
  it('trims the name', () => {
    expect(displayNameSchema.parse({ displayName: '  Uma ' }).displayName).toBe('Uma')
  })

  it('rejects empty and too long names', () => {
    expect(displayNameSchema.safeParse({ displayName: '   ' }).error?.issues[0]?.message).toBe(
      'validation.required',
    )
    expect(displayNameSchema.safeParse({ displayName: 'a'.repeat(41) }).success).toBe(false)
  })
})

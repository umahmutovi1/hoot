// The form the Bosnian copy uses when it speaks to the user ("Koliko si učila?" / "učio?").
// `profiles.gender`. Kept in memory only (it is personal data): the profile comes back from the
// query cache at start, and `LocaleSync` applies it.

export const GENDERS = ['female', 'male'] as const
export type Gender = (typeof GENDERS)[number]

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value)
}

/**
 * The i18next `context` for a gender. The base strings are the feminine form (the copy as it was
 * written), so only `male` needs a context: `key_male`, falling back to `key` where the sentence
 * has no gendered word.
 */
export function addressContext(gender: Gender | null): 'male' | undefined {
  return gender === 'male' ? 'male' : undefined
}

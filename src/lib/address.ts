// The form the Bosnian copy uses when it speaks to the user ("Koliko si učila?" / "učio?").
// `profiles.gender`, cached locally so the first paint already has the right form.

export const GENDERS = ['female', 'male'] as const
export type Gender = (typeof GENDERS)[number]

const STORAGE_KEY = 'hoot.gender'

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value)
}

export function getStoredGender(): Gender | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isGender(value) ? value : null
  } catch {
    return null
  }
}

export function storeGender(gender: Gender | null) {
  try {
    if (gender === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, gender)
  } catch {
    // Storage can be unavailable (private mode); the form then lasts for the session only.
  }
}

/**
 * The i18next `context` for a gender. The base strings are the feminine form (the copy as it was
 * written), so only `male` needs a context: `key_male`, falling back to `key` where the sentence
 * has no gendered word.
 */
export function addressContext(gender: Gender | null): 'male' | undefined {
  return gender === 'male' ? 'male' : undefined
}

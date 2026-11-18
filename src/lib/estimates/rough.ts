/**
 * Rough size of the material (PRD "Onboarding" step 7, NoviPredmet "Koliko je gradiva?"): until
 * real content is added, a subject gets a temporary source (`sources.is_rough`) whose units are
 * hour-long parts, so the plan has work to spread. Adding a real source archives it.
 */

export const ROUGH_SIZES = ['small', 'medium', 'large'] as const
export type RoughSize = (typeof ROUGH_SIZES)[number]

/** Hours of study per size: Malo ~10 h (a script), Srednje ~25 h (a book up to 250 pages), Puno ~45 h. */
export const ROUGH_HOURS: Record<RoughSize, number> = { small: 10, medium: 25, large: 45 }

/** Minutes per part: one part per hour keeps blocks and the "dokle si stigla" question simple. */
export const ROUGH_PART_MINUTES = 60

export interface RoughSourcePlan {
  /** `sources.kind` / `measure`: "Ostalo", counted in parts. */
  kind: 'other'
  measure: 'items'
  baseMinPerUnit: number
  parts: number
}

export function roughSource(size: RoughSize): RoughSourcePlan {
  return {
    kind: 'other',
    measure: 'items',
    baseMinPerUnit: ROUGH_PART_MINUTES,
    parts: Math.round((ROUGH_HOURS[size] * 60) / ROUGH_PART_MINUTES),
  }
}

const normalizeTitle = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** The same book: one title contains the other ("Oppenheim, Signals" ⊂ "Oppenheim, Signals and Systems"). */
export function sameBook(a: string, b: string): boolean {
  const x = normalizeTitle(a)
  const y = normalizeTitle(b)
  if (x.length < 4 || y.length < 4) return x === y && x.length > 0
  return x.includes(y) || y.includes(x)
}

/**
 * Rough sources replaced by the real content saved under `title`: only the one for the same book
 * (a syllabus book saved as rough). The others stay; the user is asked about them
 * (`otherRough`).
 */
export function roughToArchive<T extends { id: string; is_rough: boolean; title: string }>(
  sources: T[],
  title: string,
): T[] {
  return sources.filter((s) => s.is_rough && sameBook(s.title, title))
}

/** Rough sources still in the plan after saving `title`: offered for archiving in one tap. */
export function otherRough<T extends { id: string; is_rough: boolean; title: string }>(
  sources: T[],
  title: string,
): T[] {
  return sources.filter((s) => s.is_rough && !sameBook(s.title, title))
}

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

/** A subject's rough source is replaced once it has any real, non-rough source. */
export function roughToArchive<T extends { id: string; is_rough: boolean }>(sources: T[]): T[] {
  return sources.some((s) => !s.is_rough) ? sources.filter((s) => s.is_rough) : []
}

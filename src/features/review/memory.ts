import { localDay, type DayBoundary } from '@/lib/day'
import type { Memory } from '@/lib/srs'
import type { Tables } from '@/types/database'

/** FSRS columns shared by `units` and `cards`. */
export type MemoryRow = Pick<
  Tables<'units'>,
  | 'fsrs_stability'
  | 'fsrs_difficulty'
  | 'fsrs_state'
  | 'fsrs_reps'
  | 'fsrs_lapses'
  | 'review_streak'
  | 'last_review_at'
>

/** The memory state of a unit or card; null before its first test. */
export function memoryOf(row: MemoryRow, boundary: DayBoundary): Memory | null {
  if (row.fsrs_stability == null || row.last_review_at == null) return null
  return {
    stability: Number(row.fsrs_stability),
    difficulty: Number(row.fsrs_difficulty ?? 5),
    state: row.fsrs_state ?? 2,
    reps: row.fsrs_reps,
    lapses: row.fsrs_lapses,
    lastReviewOn: localDay(new Date(row.last_review_at), boundary),
    streak: row.review_streak,
  }
}

/** Memory columns to write after a review. */
export function memoryColumns(memory: Memory, reviewedAt: string): MemoryRow {
  return {
    fsrs_stability: Math.round(memory.stability * 10000) / 10000,
    fsrs_difficulty: Math.round(memory.difficulty * 10000) / 10000,
    fsrs_state: memory.state,
    fsrs_reps: memory.reps,
    fsrs_lapses: memory.lapses,
    review_streak: memory.streak,
    last_review_at: reviewedAt,
  }
}

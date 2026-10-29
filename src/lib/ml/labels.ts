import type { LocalDate } from '@/lib/day'

/**
 * Labels for the block completion model (RESEARCH-ML 1.2). A block is done only when it was
 * confirmed (a session on it or "Odradila sam bez timera"), skipped only when the user said so
 * ("Danas ne mogu"; every "Preskoči" is its own `block_skips` example), and otherwise unconfirmed
 * once its day is over: elapsed time never makes a block done, and `missed` (set when the day
 * passes) is read as unconfirmed, not as a failure.
 */

export type BlockLabel = 'done' | 'skipped' | 'unconfirmed'

export type BlockStatus = 'planned' | 'in_progress' | 'done' | 'missed' | 'skipped'

export interface LabelInput {
  status: BlockStatus
  onDate: LocalDate
  /** A study session was started on the block. */
  hasSession: boolean
}

/** The block's label, or null while its day is not over and nothing is marked yet. */
export function blockLabel(block: LabelInput, today: LocalDate): BlockLabel | null {
  if (block.status === 'done' || block.hasSession) return 'done'
  if (block.status === 'skipped') return 'skipped'
  return block.onDate < today ? 'unconfirmed' : null
}

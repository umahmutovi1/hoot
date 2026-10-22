import { mergeSlots, type Slot } from '@/lib/schedule'
import { breakAfterBlock, type Preset } from '@/lib/session/timer'
import { spanOf } from './place'

/** Starting a block this many minutes after its time shifts the rest of the day. */
export const LATE_AFTER_MIN = 5

export interface ShiftBlock {
  id: string
  startMin: number
  minutes: number
}

export interface ShiftResult {
  /** New start of every block that moved (blocks already late enough keep their time). */
  moved: Map<string, number>
  /** Blocks that no longer fit today, in order. */
  overflow: string[]
}

/**
 * Late start (decision after 8b): the block started now runs from `nowMin`, and the day's later
 * blocks (AI and manual alike) follow in the same order, each with the preset's breaks, only in
 * the day's free slots (classes and calendar busy time are already out of `free`) and never
 * earlier than they were. What no longer fits today is overflow: the caller hands AI blocks back
 * to the plan from tomorrow and keeps manual blocks on the day without a time.
 */
export function shiftRestOfDay(
  started: { minutes: number },
  later: ShiftBlock[],
  free: Slot[],
  input: { nowMin: number; preset: Preset; endBy?: number | null },
): ShiftResult {
  const slots = mergeSlots(free)
  const gapAfter = (minutes: number) =>
    spanOf(input.preset, minutes) + breakAfterBlock(input.preset, minutes)
  let cursor = input.nowMin + gapAfter(started.minutes)
  const moved = new Map<string, number>()
  const overflow: string[] = []

  for (const b of [...later].sort((x, y) => x.startMin - y.startMin)) {
    const span = spanOf(input.preset, b.minutes)
    const from = Math.max(cursor, b.startMin)
    const slot = slots.find(
      (s) =>
        Math.max(s.startMin, from) + span <= s.endMin &&
        (input.endBy == null || Math.max(s.startMin, from) + span <= input.endBy),
    )
    if (!slot) {
      overflow.push(b.id)
      continue
    }
    const start = Math.max(slot.startMin, from)
    if (start !== b.startMin) moved.set(b.id, start)
    cursor = start + gapAfter(b.minutes)
  }
  return { moved, overflow }
}

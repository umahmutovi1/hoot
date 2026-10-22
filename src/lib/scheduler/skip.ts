import { mergeSlots, subtractSlots, type Slot } from '@/lib/schedule'
import { breakAfterBlock, type Preset } from '@/lib/session/timer'
import { spanOf } from './place'
import type { ShiftBlock } from './shift'

export interface SkipResult {
  /** New start of every later block that moved (only when the next block starts now). */
  moved: Map<string, number>
  /** Where the skipped block goes today, or null: then it moves to the next study day. */
  skippedAt: number | null
}

/**
 * "Preskoči" (decision after 8b): the skipped block's material must not get lost. With
 * `startNext` the next block starts now and the rest of the day is pulled earlier behind it, in
 * order, with the preset's breaks, only into free time. Then the skipped block takes the earliest
 * gap left today (also between two blocks) that holds it and its breaks; without one it is null
 * and the caller moves it to the next study day.
 */
export function skipBlock(
  skipped: ShiftBlock,
  later: ShiftBlock[],
  free: Slot[],
  input: { nowMin: number; preset: Preset; startNext: boolean; endBy?: number | null },
): SkipResult {
  const slots = mergeSlots(free)
  const after = (minutes: number) => breakAfterBlock(input.preset, minutes)
  const span = (minutes: number) => spanOf(input.preset, minutes)
  const fits = (start: number, minutes: number) =>
    slots.some((s) => start >= s.startMin && start + span(minutes) <= s.endMin) &&
    (input.endBy == null || start + span(minutes) <= input.endBy)

  const order = [...later].sort((a, b) => a.startMin - b.startMin)
  const moved = new Map<string, number>()
  const times = new Map(order.map((b) => [b.id, b.startMin]))
  if (input.startNext && order.length > 0) {
    let cursor = input.nowMin
    for (const [i, b] of order.entries()) {
      // The next block starts right now; the others follow at the first time that fits, never
      // later than they were.
      const start =
        i === 0
          ? input.nowMin
          : (slotStarts(slots, cursor, b.startMin).find((t) => fits(t, b.minutes)) ?? b.startMin)
      if (start !== b.startMin) moved.set(b.id, start)
      times.set(b.id, start)
      cursor = start + span(b.minutes) + after(b.minutes)
    }
  }

  // Gaps left today: free time minus every remaining block with its break after it, and room for
  // the skipped block's own break before the next block.
  const busy = order.map((b) => {
    const start = times.get(b.id)!
    return {
      startMin: start - after(skipped.minutes),
      endMin: start + span(b.minutes) + after(b.minutes),
    }
  })
  const gaps = subtractSlots(slots, [{ startMin: 0, endMin: input.nowMin }, ...busy])
  const need = span(skipped.minutes)
  const gap = gaps.find(
    (g) =>
      g.endMin - g.startMin >= need && (input.endBy == null || g.startMin + need <= input.endBy),
  )
  return { moved, skippedAt: gap ? gap.startMin : null }
}

/** Candidate starts from `from` up to `until`: `from` itself and every slot start in between. */
function slotStarts(slots: Slot[], from: number, until: number): number[] {
  return [from, ...slots.map((s) => s.startMin).filter((t) => t > from && t <= until)]
}

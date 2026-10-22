import type { LocalDate } from '@/lib/day'
import type { BlockKind } from './types'

/**
 * "Imam samo 30 min" (PRD "Brze akcije dana"): the most valuable piece for the time there is,
 * without changing the plan. A check due today with the lowest strength first, then the most
 * urgent block of today, then the next block by urgency. The session is tied to today's block
 * the piece comes from; what is left of that block goes back into the plan from tomorrow.
 */

export interface PickBlock {
  id: string
  subjectId: string
  kind: BlockKind
  onDate: LocalDate
  startMin: number | null
  minutes: number
  /** Days until the block's goal (smaller = more urgent); null without a goal. */
  daysToGoal: number | null
  units: { unitId: string; minutes: number }[]
}

export interface PickReview {
  unitId: string
  subjectId: string
  minutes: number
  /** FSRS retrievability today (Stage 9); null = unknown, ranked after known ones. */
  retrievability: number | null
  nextReviewOn: LocalDate
}

export interface PickInput {
  minutes: number
  today: LocalDate
  /** Today's blocks that are not done yet. */
  todayBlocks: PickBlock[]
  /** Units due for a check (`next_review_on` ≤ today). */
  dueReviews: PickReview[]
  /** Planned blocks after today. */
  laterBlocks: PickBlock[]
}

export interface Pick {
  subjectId: string
  /** Today's block the session belongs to; null for a later block or a loose review. */
  blockId: string | null
  kind: BlockKind
  minutes: number
  units: { unitId: string; minutes: number }[]
  from: 'review' | 'today' | 'next'
}

const urgency = (a: PickBlock, b: PickBlock) =>
  (a.daysToGoal ?? 9999) - (b.daysToGoal ?? 9999) ||
  (a.onDate < b.onDate ? -1 : a.onDate > b.onDate ? 1 : 0) ||
  (a.startMin ?? 9999) - (b.startMin ?? 9999) ||
  (a.id < b.id ? -1 : 1)

/** The first `minutes` of a block's units, in order. */
function trim(units: PickBlock['units'], minutes: number) {
  const out: { unitId: string; minutes: number }[] = []
  let left = minutes
  for (const u of units) {
    if (left <= 0) break
    const m = Math.min(u.minutes, left)
    out.push({ unitId: u.unitId, minutes: m })
    left -= m
  }
  return out
}

function fromBlock(block: PickBlock, minutes: number, from: Pick['from']): Pick {
  const m = Math.min(minutes, block.minutes)
  return {
    subjectId: block.subjectId,
    blockId: from === 'today' ? block.id : null,
    kind: block.kind,
    minutes: m,
    units: trim(block.units, m),
    from,
  }
}

export function pickForTime(input: PickInput): Pick | null {
  const { minutes } = input
  if (minutes <= 0) return null

  const due = input.dueReviews
    .filter((r) => r.nextReviewOn <= input.today)
    .sort(
      (a, b) =>
        (a.retrievability ?? 2) - (b.retrievability ?? 2) ||
        (a.nextReviewOn < b.nextReviewOn ? -1 : a.nextReviewOn > b.nextReviewOn ? 1 : 0) ||
        (a.unitId < b.unitId ? -1 : 1),
    )
  if (due.length > 0) {
    const subjectId = due[0]!.subjectId
    const units: Pick['units'] = []
    let left = minutes
    for (const r of due.filter((x) => x.subjectId === subjectId)) {
      if (r.minutes > left && units.length > 0) continue
      const m = Math.min(r.minutes, left)
      units.push({ unitId: r.unitId, minutes: m })
      left -= m
      if (left <= 0) break
    }
    const ids = new Set(units.map((u) => u.unitId))
    const block = input.todayBlocks.find(
      (b) => b.kind === 'review' && b.units.some((u) => ids.has(u.unitId)),
    )
    return {
      subjectId,
      blockId: block?.id ?? null,
      kind: 'review',
      minutes: minutes - left,
      units,
      from: 'review',
    }
  }

  const today = [...input.todayBlocks].filter((b) => b.minutes > 0).sort(urgency)
  if (today.length > 0) return fromBlock(today[0]!, minutes, 'today')

  const later = [...input.laterBlocks].filter((b) => b.onDate > input.today && b.minutes > 0)
  later.sort((a, b) => (a.onDate < b.onDate ? -1 : a.onDate > b.onDate ? 1 : 0) || urgency(a, b))
  if (later.length > 0) return fromBlock(later[0]!, minutes, 'next')
  return null
}

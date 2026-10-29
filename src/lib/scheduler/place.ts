import { mergeSlots, subtractSlots, type Slot } from '@/lib/schedule'
import { PART_RANGES, partOf, type SlotPart } from '@/lib/schedule/rhythm'
import {
  breakAfterBlock,
  breakMinAfter,
  breaksWithin,
  flowBreakMin,
  MINUTE,
  planIntervalMin,
  workMinAt,
  type Preset,
} from '@/lib/session/timer'
import { SLOT_GAP } from './constants'
import type { BlockKind } from './types'

/**
 * `placeTimes()` (PRD "Lista vs satnica"): puts a day's blocks into its free slots. A block and
 * the breaks inside it (from the default preset) must fit one free slot, and the break after a
 * block is kept free before the next one. A block that does not fit is split into multiples of
 * the study interval; what fits nowhere is returned as unplaced. Free slots shorter than the
 * minimum block take only reviews (micro-blocks). First-pass and harder blocks get the better
 * slots (the completion model's expected done share per part of the day, or the onboarding prior
 * without it); reviews and recaps take the earliest time left. Fully deterministic: the one
 * exploring block takes a posterior draw made outside.
 */

export interface PlaceItem {
  key: string
  minutes: number
  kind: BlockKind
  /** Higher = harder (first pass, difficulty): placed first, into better slots. */
  demand: number
  /** Manual block with a set time: stays exactly there. */
  fixedStart?: number | null
  /** Manual block without a time: placed before AI blocks. */
  manual?: boolean
}

export interface PlaceDayInput {
  slots: Slot[]
  preset: Preset
  minBlockMinutes: number
  preferredParts: readonly SlotPart[]
  /** Slot score per part of the day (completion model, cautious); replaces `preferredParts`. */
  scores?: Record<SlotPart, number> | null
  /**
   * A posterior draw of the expected done share (Thompson): the first learning block of the day
   * takes the start with the best draw among starts within `SLOT_GAP` of the best score.
   */
  explore?: Record<SlotPart, number> | null
  /** Nothing starts before this minute (today planned now). */
  notBefore?: number | null
  /** Nothing ends after this minute (the eve of an exam). */
  endBy?: number | null
}

/** Longest block: whole study intervals up to ~100 min (2 × 50, 4 × 25). */
export function maxBlockOf(preset: Preset): number {
  const interval = planIntervalMin(preset)
  return interval * Math.max(1, Math.ceil(100 / interval))
}

export interface Placement {
  key: string
  /** 0 for the first (or only) part of a split block. */
  part: number
  startMin: number
  minutes: number
}

export interface PlaceDayResult {
  /** By start time. */
  placements: Placement[]
  /** Minutes of each item that fit nowhere. */
  unplaced: Map<string, number>
}

/** Study minutes plus the breaks inside a block of that length. */
export function spanOf(preset: Preset, minutes: number): number {
  return minutes + breaksWithin(preset, minutes).reduce((s, b) => s + b, 0)
}

/** Longest study time whose span fits `length` minutes. */
export function maxStudyIn(preset: Preset, length: number): number {
  if (length <= 0) return 0
  if (preset.kind === 'free') return length
  let study = 0
  let used = 0
  for (let n = 0; ; n++) {
    const work = preset.kind === 'cycle' ? workMinAt(preset, n) : 50
    if (used + work >= length) return study + (length - used)
    study += work
    used += work
    const pause = preset.kind === 'cycle' ? breakMinAfter(preset, n) : flowBreakMin(50 * MINUTE)
    if (used + pause >= length) return study
    used += pause
  }
}

type Scores = Partial<Record<SlotPart, number>>

/** Onboarding prior: preferred parts of the day 1, others 0.6 (all 1 without a prior). */
function priorScores(parts: readonly SlotPart[]): Scores | null {
  if (parts.length === 0) return null
  return Object.fromEntries(
    (Object.keys(PART_RANGES) as SlotPart[]).map((p) => [p, parts.includes(p) ? 1 : 0.6]),
  )
}

function spanScore(start: number, minutes: number, scores: Scores | null): number {
  if (!scores || minutes <= 0) return 1
  let total = 0
  for (let m = start; m < start + minutes; m += 5) total += scores[partOf(m)] ?? 0
  return total / Math.ceil(minutes / 5)
}

const isReview = (kind: BlockKind) => kind === 'review' || kind === 'recap'

/** Possible starts inside a slot: its start, part-of-day boundaries and the latest start. */
function candidateStarts(slot: Slot, span: number): number[] {
  const latest = slot.endMin - span
  if (latest < slot.startMin) return []
  const out = new Set([slot.startMin, latest])
  for (const r of Object.values(PART_RANGES)) {
    if (r.startMin > slot.startMin && r.startMin <= latest) out.add(r.startMin)
  }
  return [...out].sort((a, b) => a - b)
}

interface Position {
  start: number
  score: number
}

const better = (a: Position, b: Position | null) =>
  !b || a.score > b.score + 1e-9 || (Math.abs(a.score - b.score) <= 1e-9 && a.start < b.start)

/**
 * Best start for `minutes` of study: the earliest one among starts whose score is within
 * `SLOT_GAP` of the best (a smaller difference is noise, and an earlier start keeps the rest of
 * the slot whole); reviews: earliest. Exploring: the best draw among those starts.
 */
function bestPosition(
  free: Slot[],
  minutes: number,
  kind: BlockKind,
  input: PlaceDayInput,
  exploring = false,
): Position | null {
  const span = spanOf(input.preset, minutes)
  const scores = input.scores ?? priorScores(input.preferredParts)
  const all: Position[] = []
  for (const slot of free) {
    const length = slot.endMin - slot.startMin
    if (!isReview(kind) && length < input.minBlockMinutes) continue
    for (const start of candidateStarts(slot, span))
      all.push({ start, score: isReview(kind) ? 0 : spanScore(start, minutes, scores) })
  }
  if (all.length === 0) return null
  const top = Math.max(...all.map((p) => p.score))
  const near = all.filter((p) => p.score >= top - SLOT_GAP - 1e-9)
  let best: Position | null = null
  for (const p of near) if (!best || p.start < best.start) best = p
  if (!exploring || !input.explore) return best
  let pick: Position | null = null
  for (const p of near) {
    const drawn = { start: p.start, score: spanScore(p.start, minutes, input.explore) }
    if (better(drawn, pick)) pick = drawn
  }
  return pick && { start: pick.start, score: spanScore(pick.start, minutes, scores) }
}

/** Largest part of a block that fits a free slot, rounded down to whole study intervals. */
function bestChunk(
  free: Slot[],
  left: number,
  kind: BlockKind,
  input: PlaceDayInput,
): { minutes: number; start: number } | null {
  const interval = planIntervalMin(input.preset)
  const smallest = isReview(kind) ? Math.min(left, 5) : Math.min(left, input.minBlockMinutes)
  let best: { minutes: number; start: number; score: number } | null = null
  for (const slot of free) {
    const length = slot.endMin - slot.startMin
    if (!isReview(kind) && length < input.minBlockMinutes) continue
    let minutes = Math.min(left, maxStudyIn(input.preset, length))
    if (minutes >= interval && minutes < left) minutes = Math.floor(minutes / interval) * interval
    if (minutes < smallest || minutes <= 0) continue
    const position = bestPosition([slot], minutes, kind, input)
    if (!position) continue
    const better =
      !best ||
      minutes > best.minutes ||
      (minutes === best.minutes && position.score > best.score + 1e-9) ||
      (minutes === best.minutes &&
        Math.abs(position.score - best.score) <= 1e-9 &&
        position.start < best.start)
    if (better) best = { minutes, start: position.start, score: position.score }
  }
  return best && { minutes: best.minutes, start: best.start }
}

/** Longest break of a preset (the most a block before another one may need). */
function longestBreak(preset: Preset): number {
  if (preset.kind === 'free') return 0
  if (preset.kind === 'flow') return 20
  return Math.max(
    0,
    preset.longBreak?.min ?? 0,
    ...preset.steps.filter((s) => s.kind === 'break').map((s) => s.min),
  )
}

/** Position right after the previous part (and its break), when that time is free. */
function followOn(
  free: Slot[],
  prevEnd: number,
  minutes: number,
  input: PlaceDayInput,
): Position | null {
  const span = spanOf(input.preset, minutes)
  const start = free.find((s) => s.startMin >= prevEnd && s.startMin <= prevEnd + 30)?.startMin
  if (start === undefined) return null
  const slot = free.find((s) => s.startMin === start)!
  if (slot.endMin - slot.startMin < Math.max(span, input.minBlockMinutes)) return null
  return { start, score: 0 }
}

function clip(slots: Slot[], from: number | null | undefined, to: number | null | undefined) {
  return mergeSlots(slots)
    .map((s) => ({
      startMin: Math.max(s.startMin, from ?? s.startMin),
      endMin: Math.min(s.endMin, to ?? s.endMin),
    }))
    .filter((s) => s.endMin > s.startMin)
}

export function placeTimes(items: PlaceItem[], input: PlaceDayInput): PlaceDayResult {
  let free = clip(input.slots, input.notBefore, input.endBy)
  const placements: Placement[] = []
  const unplaced = new Map<string, number>()

  // A placed block keeps its break after it free, and the longest break before it, so a block
  // placed earlier in the day later still has room for its own break.
  const before = longestBreak(input.preset)
  const occupy = (start: number, minutes: number) => {
    const end = start + spanOf(input.preset, minutes) + breakAfterBlock(input.preset, minutes)
    free = subtractSlots(free, [{ startMin: start - before, endMin: end }])
  }

  for (const item of items) {
    if (item.fixedStart === null || item.fixedStart === undefined) continue
    placements.push({ key: item.key, part: 0, startMin: item.fixedStart, minutes: item.minutes })
    occupy(item.fixedStart, item.minutes)
  }

  const order = items
    .filter((i) => i.fixedStart === null || i.fixedStart === undefined)
    .sort(
      (a, b) =>
        Number(Boolean(b.manual)) - Number(Boolean(a.manual)) ||
        Number(isReview(a.kind)) - Number(isReview(b.kind)) ||
        b.demand - a.demand ||
        b.minutes - a.minutes ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    )

  const maxBlock = maxBlockOf(input.preset)
  const explorer = order.find((i) => !i.manual && !isReview(i.kind))?.key
  for (const item of order) {
    let left = item.minutes
    let part = 0
    let prevEnd: number | null = null
    while (left > 0) {
      const want = Math.min(left, maxBlock)
      // The next part of a long block continues right after the previous one when it can.
      const next: Position | null = prevEnd === null ? null : followOn(free, prevEnd, want, input)
      const whole: Position | null =
        next ?? bestPosition(free, want, item.kind, input, item.key === explorer && part === 0)
      const chunk: { start: number; minutes: number } | null = whole
        ? { start: whole.start, minutes: want }
        : bestChunk(free, want, item.kind, input)
      if (!chunk) break
      placements.push({
        key: item.key,
        part: part++,
        startMin: chunk.start,
        minutes: chunk.minutes,
      })
      occupy(chunk.start, chunk.minutes)
      prevEnd = chunk.start + spanOf(input.preset, chunk.minutes)
      left -= chunk.minutes
    }
    if (left > 0) unplaced.set(item.key, left)
  }

  placements.sort((a, b) => a.startMin - b.startMin || (a.key < b.key ? -1 : 1))
  return { placements, unplaced }
}

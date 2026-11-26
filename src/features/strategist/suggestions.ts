import { diffDays, type LocalDate } from '@/lib/day'
import type { Insight } from '@/lib/insights'
import type { Candidate } from '@/lib/strategist'
import type { PlanBlockRow } from '@/features/plan/state'
import { DECISION_DAYS, isReverted, latestFeedback, type Feedback } from './feedback'

/**
 * Prijedlozi (board Prijedlozi): what waits for a decision. "ask" changes an input only on
 * approval; "done" is what the replan already did on its own (missed work placed again), which
 * the user confirms ("U redu") or undoes ("Poništi").
 */

/** A missed block whose material the replan placed again ("Hoot je već uradio"). */
export interface MovedWork {
  missedId: string
  subjectId: string
  goalId: string
  /** Units of the missed block that are in the new block. */
  unitIds: string[]
  minutes: number
  on: LocalDate
  startMin: number | null
}

export type Suggestion =
  | {
      id: string
      kind: 'ask'
      from: 'strategist'
      subjectId: string | null
      candidate: Candidate
      reason: string | null
    }
  | { id: string; kind: 'ask'; from: 'insight'; subjectId: string | null; insight: Insight }
  | { id: string; kind: 'done'; from: 'replan'; subjectId: string; moved: MovedWork }

export type SuggestionState = 'pending' | 'approved' | 'declined' | 'undone'

export interface ShownSuggestion {
  suggestion: Suggestion
  state: SuggestionState
}

/** Null when the suggestion is hidden for good ("Nije korisno"). */
export function stateOf(rows: Feedback[], s: Suggestion, today: LocalDate): SuggestionState | null {
  const latest = latestFeedback(rows, s.id)
  if (!latest || isReverted(latest)) return 'pending'
  if (latest.status === 'not_useful') return null
  if (diffDays(latest.created_at.slice(0, 10), today) >= DECISION_DAYS) return 'pending'
  if (latest.status === 'accepted') return 'approved'
  return s.kind === 'done' ? 'undone' : 'declined'
}

function storedSuggestion(row: Feedback): Suggestion | null {
  const p = row.payload
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const s = p.suggestion
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null
  if (typeof s.id !== 'string' || (s.kind !== 'ask' && s.kind !== 'done')) return null
  return s as unknown as Suggestion
}

/** The latest row of every key, newest first. */
function latestRows(rows: Feedback[]) {
  const seen = new Set<string>()
  return [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    .filter((r) => {
      const key = r.insight_id ?? r.candidate_id
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/**
 * Live suggestions first, then the ones decided on Prijedlozi in the last `DECISION_DAYS` that
 * the rules no longer offer (an applied action usually removes its own reason), so a decision
 * stays visible and can be taken back.
 */
export function collectSuggestions(
  live: Suggestion[],
  rows: Feedback[],
  today: LocalDate,
): ShownSuggestion[] {
  const liveIds = new Set(live.map((s) => s.id))
  const decided = latestRows(rows).flatMap((r) => {
    const s = storedSuggestion(r)
    if (!s || liveIds.has(s.id)) return []
    if (diffDays(r.created_at.slice(0, 10), today) >= DECISION_DAYS) return []
    return [s]
  })
  return [...live, ...decided].flatMap((suggestion) => {
    const state = stateOf(rows, suggestion, today)
    return state ? [{ suggestion, state }] : []
  })
}

/**
 * "Potvrdi N" acts only on what is on screen: it approves the open asks (at most `asksLeft`, the
 * weekly limit of accepted actions) and confirms what Hoot already did.
 */
export function confirmTargets(shown: ShownSuggestion[], asksLeft: number) {
  let asks = 0
  return shown.filter(({ suggestion, state }) => {
    if (state !== 'pending') return false
    if (suggestion.kind === 'done') return true
    asks += 1
    return asks <= asksLeft
  })
}

export function summaryOf(all: ShownSuggestion[]) {
  return {
    pending: all.filter((s) => s.state === 'pending').length,
    applied: all.filter((s) => s.state === 'approved').length,
  }
}

/**
 * AI blocks from `from` until yesterday that were missed and whose material the replan has
 * placed again from today on (the earliest planned block with any of their units).
 */
export function movedWork(blocks: PlanBlockRow[], from: LocalDate, today: LocalDate): MovedWork[] {
  return blocks.flatMap((b) => {
    if (
      b.origin !== 'ai' ||
      !b.assessment_id ||
      b.on_date < from ||
      b.on_date >= today ||
      (b.status !== 'missed' && b.status !== 'planned')
    )
      return []
    const ids = new Set(b.plan_block_units.map((u) => u.unit_id))
    const to = blocks
      .filter(
        (x) =>
          x.id !== b.id &&
          x.on_date >= today &&
          x.status === 'planned' &&
          x.plan_block_units.some((u) => ids.has(u.unit_id)),
      )
      .sort(
        (x, y) => x.on_date.localeCompare(y.on_date) || (x.start_min ?? 0) - (y.start_min ?? 0),
      )[0]
    if (!to) return []
    const unitIds = to.plan_block_units.map((u) => u.unit_id).filter((id) => ids.has(id))
    return [
      {
        missedId: b.id,
        subjectId: b.subject_id,
        goalId: b.assessment_id,
        unitIds,
        minutes: b.planned_minutes,
        on: to.on_date,
        startMin: to.start_min,
      },
    ]
  })
}

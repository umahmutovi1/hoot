import { addDays, diffDays, weekdayOf, type LocalDate } from '@/lib/day'
import { mergeSlots, type Slot } from '@/lib/schedule'
import {
  proposeRules,
  intersect,
  DEFAULT_RHYTHM,
  PART_RANGES,
  SLOT_PARTS,
  type SlotPart,
} from '@/lib/schedule/rhythm'
import { plan } from '@/lib/scheduler/plan'
import { addPerDay, cutCandidates, type SubjectBehindInput } from '@/lib/scheduler/suggestions'
import type { PlanResult, PlanState, SlotCompletion } from '@/lib/scheduler/types'
import { MIN_SLOT_SESSIONS, type SlotSignals } from '@/lib/slots/signals'

/**
 * AI strategist candidates (PRD "Scheduler, replan i AI strategist", Sprint 17): rules in code
 * propose input changes, each with its effect computed by running `plan()` on the changed state.
 * The LLM only picks up to 3 of these by `id` and explains them; it cannot invent an action.
 * Applying one is an input change plus a replan, like a suggestion card.
 */

export type StrategistAction =
  | { kind: 'set_priority'; subjectId: string; priority: number }
  | { kind: 'boost_priority'; subjectId: string; until: LocalDate }
  | { kind: 'set_mode'; subjectId: string; mode: 'regular' | 'campaign' }
  | { kind: 'set_campaign_start'; subjectId: string; start: LocalDate }
  | { kind: 'add_hours'; minutesPerDay: number; until: LocalDate }
  | { kind: 'drop_unit'; goalId: string; unitIds: string[] }
  | { kind: 'change_buffer'; days: number }
  /** Read but never tested: checks for these units first. */
  | { kind: 'reprioritize_unit'; subjectId: string; unitIds: string[] }
  | { kind: 'avoid_slot'; weekend: boolean; part: SlotPart }
  | { kind: 'add_slot'; weekend: boolean; part: SlotPart }
  /** "Izbjegavanje": a 15 min first step tomorrow in the best slot; no plan change. */
  | { kind: 'first_step'; subjectId: string; on: LocalDate; part: SlotPart }

export type CandidateRule =
  'deficit' | 'behind' | 'crowding' | 'slot' | 'read_untested' | 'avoidance'

export interface GoalEffect {
  goalId: string
  deficitBefore: number
  deficitAfter: number
}

export interface CandidateEffect {
  /** Total required minutes that do not fit, before and after. */
  deficitBefore: number
  deficitAfter: number
  /** Goals whose deficit changes. */
  goals: GoalEffect[]
  /** Planned minutes per subject over the next 7 days: after − before (only changes). */
  weekMinutes: Record<string, number>
}

export interface Candidate {
  /** Stable for the same action, so the LLM's choice can be checked against the list. */
  id: string
  rule: CandidateRule
  action: StrategistAction
  /** Null for actions that change no plan input (first step). */
  effect: CandidateEffect | null
}

export interface CandidateInput {
  state: PlanState
  result: PlanResult
  today: LocalDate
  behind: SubjectBehindInput[]
  /** Slot signals and the completion model's expected done share per slot. */
  slots: SlotSignals | null
  slotCompletion: SlotCompletion | null
  /** Subjects the "Izbjegavanje" insight found (`src/lib/insights/`). */
  avoided: string[]
}

/** At most this many candidates go to the LLM (and to the check-in without AI). */
export const MAX_CANDIDATES = 8
/** Exams this close count as crowded. */
export const CROWDING_DAYS = 3
/** Read units without a test for a subject with an exam this close. */
export const READ_UNTESTED_DAYS = 14
export const READ_UNTESTED_MIN = 3
/**
 * Slot cards as in the PRD ("propadne 4 od 5 blokova", "fokus 2.7/3"): avoid a slot whose blocks
 * are mostly not done or whose focus is low, add one whose focus is high; the combined signal
 * must point the same way.
 */
const AVOID_COMPLETION = 0.5
const AVOID_FOCUS = 1.5
const ADD_FOCUS = 2.5

const EFFECT_DAYS = 7

const isWeekend = (d: LocalDate) => weekdayOf(d) >= 5

function withoutPart(slots: Slot[], part: SlotPart): Slot[] {
  const r = PART_RANGES[part]
  return slots.flatMap((s) => {
    if (s.endMin <= r.startMin || s.startMin >= r.endMin) return [s]
    const out: Slot[] = []
    if (s.startMin < r.startMin) out.push({ startMin: s.startMin, endMin: r.startMin })
    if (s.endMin > r.endMin) out.push({ startMin: r.endMin, endMin: s.endMin })
    return out
  })
}

/** The state with the action applied, as the replan after "Primijeni" would see it. */
export function applyAction(
  state: PlanState,
  action: StrategistAction,
  today: LocalDate,
): PlanState {
  const subjects = (patch: (s: PlanState['subjects'][number]) => PlanState['subjects'][number]) =>
    state.subjects.map((s) => ('subjectId' in action && s.id === action.subjectId ? patch(s) : s))
  switch (action.kind) {
    case 'set_priority':
      return { ...state, subjects: subjects((s) => ({ ...s, priority: action.priority })) }
    case 'boost_priority':
      return { ...state, subjects: subjects((s) => ({ ...s, boostUntil: action.until })) }
    case 'set_mode':
      return { ...state, subjects: subjects((s) => ({ ...s, mode: action.mode })) }
    case 'set_campaign_start':
      return {
        ...state,
        subjects: subjects((s) => ({ ...s, mode: 'campaign', campaignStartOn: action.start })),
      }
    case 'add_hours':
      return {
        ...state,
        days: state.days.map((d) =>
          d.date <= action.until && d.slots.length > 0
            ? { ...d, cap: d.cap + action.minutesPerDay }
            : d,
        ),
      }
    case 'drop_unit': {
      const drop = new Set(action.unitIds)
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId ? { ...g, unitIds: g.unitIds.filter((id) => !drop.has(id)) } : g,
        ),
      }
    }
    case 'change_buffer':
      return { ...state, settings: { ...state.settings, bufferDays: action.days } }
    case 'reprioritize_unit': {
      const ids = new Set(action.unitIds)
      return {
        ...state,
        units: state.units.map((u) =>
          ids.has(u.id) && (u.nextReviewOn === null || u.nextReviewOn > today)
            ? { ...u, nextReviewOn: today }
            : u,
        ),
      }
    }
    case 'avoid_slot':
      return {
        ...state,
        days: state.days.map((d) =>
          d.date > today && isWeekend(d.date) === action.weekend
            ? {
                ...d,
                slots: mergeSlots([
                  ...withoutPart(d.slots, action.part),
                  ...(d.slotPreserved ?? []),
                ]),
              }
            : d,
        ),
      }
    case 'add_slot': {
      const allowed = proposeRules(state.rhythm ?? DEFAULT_RHYTHM, [action.part])
      return {
        ...state,
        days: state.days.map((d) =>
          d.date > today && isWeekend(d.date) === action.weekend
            ? {
                ...d,
                slots: mergeSlots([
                  ...d.slots,
                  ...allowed
                    .filter((r) => r.weekday === weekdayOf(d.date))
                    .flatMap((r) =>
                      d.slotAdditions ? d.slotAdditions.flatMap((s) => intersect(r, s) ?? []) : [r],
                    ),
                ]),
              }
            : d,
        ),
      }
    }
    case 'first_step':
      return state
  }
}

function effectOf(
  state: PlanState,
  before: PlanResult,
  action: StrategistAction,
  today: LocalDate,
): CandidateEffect {
  const after = plan(applyAction(state, action, today))
  const deficits = (r: PlanResult) => new Map(r.deficits.map((d) => [d.goalId, d.minutes]))
  const b = deficits(before)
  const a = deficits(after)
  const goals = [...new Set([...b.keys(), ...a.keys()])]
    .sort()
    .map((goalId) => ({
      goalId,
      deficitBefore: Math.round(b.get(goalId) ?? 0),
      deficitAfter: Math.round(a.get(goalId) ?? 0),
    }))
    .filter((g) => g.deficitBefore !== g.deficitAfter)
  const last = addDays(today, EFFECT_DAYS)
  const week = (r: PlanResult) => {
    const out = new Map<string, number>()
    for (const x of r.blocks)
      if (x.onDate >= today && x.onDate < last)
        out.set(x.subjectId, (out.get(x.subjectId) ?? 0) + x.minutes)
    return out
  }
  const wb = week(before)
  const wa = week(after)
  const weekMinutes: Record<string, number> = {}
  for (const id of [...new Set([...wb.keys(), ...wa.keys()])].sort()) {
    const delta = Math.round((wa.get(id) ?? 0) - (wb.get(id) ?? 0))
    if (delta !== 0) weekMinutes[id] = delta
  }
  const total = (m: Map<string, number>) => Math.round([...m.values()].reduce((s, x) => s + x, 0))
  return { deficitBefore: total(b), deficitAfter: total(a), goals, weekMinutes }
}

function idOf(action: StrategistAction): string {
  switch (action.kind) {
    case 'set_priority':
      return `set_priority:${action.subjectId}:${action.priority}`
    case 'boost_priority':
      return `boost_priority:${action.subjectId}:${action.until}`
    case 'set_mode':
      return `set_mode:${action.subjectId}:${action.mode}`
    case 'set_campaign_start':
      return `set_campaign_start:${action.subjectId}:${action.start}`
    case 'add_hours':
      return `add_hours:${action.minutesPerDay}:${action.until}`
    case 'drop_unit':
      return `drop_unit:${action.goalId}:${action.unitIds.length}`
    case 'change_buffer':
      return `change_buffer:${action.days}`
    case 'reprioritize_unit':
      return `reprioritize_unit:${action.subjectId}`
    case 'avoid_slot':
    case 'add_slot':
      return `${action.kind}:${action.weekend ? 'weekend' : 'weekday'}:${action.part}`
    case 'first_step':
      return `first_step:${action.subjectId}`
  }
}

/** Rules → actions (no effects yet). */
function proposals(input: CandidateInput): { rule: CandidateRule; action: StrategistAction }[] {
  const { state, result, today } = input
  const out: { rule: CandidateRule; action: StrategistAction }[] = []
  const subjects = new Map(state.subjects.map((s) => [s.id, s]))
  const exams = state.goals
    .filter((g) => g.kind === 'exam' && g.on > today)
    .sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : a.id < b.id ? -1 : 1))
  const nextExam = (subjectId: string) => exams.find((g) => g.subjectId === subjectId)

  // Deficit: more priority, more time, less scope, a shorter buffer.
  for (const d of result.deficits) {
    const s = subjects.get(d.subjectId)
    if (s && s.priority < 5)
      out.push({
        rule: 'deficit',
        action: { kind: 'set_priority', subjectId: s.id, priority: s.priority + 1 },
      })
    out.push({
      rule: 'deficit',
      action: {
        kind: 'add_hours',
        minutesPerDay: addPerDay(state, d.minutes, d.lastDay),
        until: d.lastDay,
      },
    })
    const cut = cutCandidates(state, d.goalId, d.minutes).filter((c) => c.goalId === d.goalId)
    if (cut.length > 0)
      out.push({
        rule: 'deficit',
        action: { kind: 'drop_unit', goalId: d.goalId, unitIds: cut.map((c) => c.unitId).sort() },
      })
  }
  if (result.deficits.length > 0 && state.settings.bufferDays > 0)
    out.push({
      rule: 'deficit',
      action: { kind: 'change_buffer', days: state.settings.bufferDays - 1 },
    })

  // Behind the lectures: boost until the exam, regular mode or an earlier campaign.
  for (const b of input.behind) {
    const s = subjects.get(b.subjectId)
    const exam = nextExam(b.subjectId)
    if (!s || !exam) continue
    out.push({
      rule: 'behind',
      action: { kind: 'boost_priority', subjectId: s.id, until: addDays(exam.on, -1) },
    })
    if (s.mode === 'campaign')
      out.push({ rule: 'behind', action: { kind: 'set_mode', subjectId: s.id, mode: 'regular' } })
  }

  // Crowded exams: a campaign subject whose exam is within days of another starts a week earlier.
  for (const [i, g] of exams.entries()) {
    const crowded = exams.some(
      (o, j) =>
        j !== i && o.subjectId !== g.subjectId && Math.abs(diffDays(o.on, g.on)) <= CROWDING_DAYS,
    )
    const s = subjects.get(g.subjectId)
    const start = result.campaignStarts[g.subjectId]
    if (!crowded || !s || s.mode !== 'campaign' || !start) continue
    const earlier = addDays(start, -7)
    out.push({
      rule: 'crowding',
      action: {
        kind: 'set_campaign_start',
        subjectId: s.id,
        start: earlier < state.from ? state.from : earlier,
      },
    })
  }

  // Read without a test: checks first for a subject with an exam soon.
  for (const s of state.subjects) {
    const exam = nextExam(s.id)
    if (!exam || diffDays(today, exam.on) > READ_UNTESTED_DAYS) continue
    const scope = new Set(exam.unitIds)
    const untested = state.units
      .filter((u) => u.subjectId === s.id && scope.has(u.id) && u.level === 1 && !u.memory)
      .map((u) => u.id)
      .sort()
    if (untested.length >= READ_UNTESTED_MIN)
      out.push({
        rule: 'read_untested',
        action: { kind: 'reprioritize_unit', subjectId: s.id, unitIds: untested },
      })
  }

  // Slots with enough sessions and a clear difference.
  if (input.slots)
    for (const weekend of [false, true]) {
      const kind = weekend ? 'weekend' : 'weekday'
      for (const part of SLOT_PARTS) {
        const sig = input.slots[kind][part]
        if (sig.sessions < MIN_SLOT_SESSIONS) continue
        const done = input.slotCompletion?.[kind][part] ?? 1
        if (
          done < AVOID_COMPLETION ||
          (sig.focus !== null && sig.focus <= AVOID_FOCUS && sig.z < 0)
        )
          out.push({ rule: 'slot', action: { kind: 'avoid_slot', weekend, part } })
        else if (sig.focus !== null && sig.focus >= ADD_FOCUS && sig.z > 0)
          out.push({ rule: 'slot', action: { kind: 'add_slot', weekend, part } })
      }
    }

  // Avoided subjects: a small first step tomorrow in the best part of the day.
  const tomorrow = addDays(today, 1)
  const scores = state.slotScores?.[isWeekend(tomorrow) ? 'weekend' : 'weekday']
  const best = scores
    ? [...SLOT_PARTS].sort(
        (a, b) => scores[b] - scores[a] || SLOT_PARTS.indexOf(a) - SLOT_PARTS.indexOf(b),
      )[0]!
    : (state.preferredParts[0] ?? 'afternoon')
  for (const subjectId of [...input.avoided].sort())
    if (subjects.has(subjectId))
      out.push({
        rule: 'avoidance',
        action: { kind: 'first_step', subjectId, on: tomorrow, part: best },
      })

  return out
}

/**
 * Candidates with their effects, best first: the largest drop in deficit, then the one that
 * changes the plan least; actions without a plan change (first step) after those that help.
 */
export function candidates(input: CandidateInput): Candidate[] {
  const seen = new Set<string>()
  const list: Candidate[] = []
  for (const p of proposals(input)) {
    const id = idOf(p.action)
    if (seen.has(id)) continue
    if (p.action.kind === 'add_slot' || p.action.kind === 'avoid_slot') {
      const changed = applyAction(input.state, p.action, input.today)
      if (
        changed.days.every(
          (d, i) => JSON.stringify(d.slots) === JSON.stringify(input.state.days[i]!.slots),
        )
      )
        continue
    }
    seen.add(id)
    list.push({
      id,
      rule: p.rule,
      action: p.action,
      effect:
        p.action.kind === 'first_step'
          ? null
          : effectOf(input.state, input.result, p.action, input.today),
    })
  }
  const gain = (c: Candidate) => (c.effect ? c.effect.deficitBefore - c.effect.deficitAfter : 0)
  const churn = (c: Candidate) =>
    c.effect ? Object.values(c.effect.weekMinutes).reduce((s, x) => s + Math.abs(x), 0) : 0
  return list
    .filter((c) => c.effect === null || c.rule !== 'deficit' || gain(c) > 0)
    .sort((a, b) => gain(b) - gain(a) || churn(a) - churn(b) || (a.id < b.id ? -1 : 1))
    .slice(0, MAX_CANDIDATES)
}

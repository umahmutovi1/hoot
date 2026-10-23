import { addDays, diffDays, type LocalDate } from '@/lib/day'
import type { PaceAction } from '@/lib/pace'
import { priorityRule, RESERVE, reviewMinutes } from './constants'
import { plan, remainingWork } from './plan'
import type { PlanResult, PlanState } from './types'

/**
 * Suggestion cards (PRD "Scheduler" step 12): rules in code turn the plan and its inputs into
 * changes of input the user applies with one tap (then replan). Today shows the first one above
 * the blocks and the rest under "Još N prijedloga". Texts are neutral; the UI words them.
 */

export interface CutUnit {
  unitId: string
  goalId: string
  subjectId: string
  minutes: number
}

export type Suggestion =
  | {
      kind: 'fresh_start'
      key: string
      /** Required work that does not fit, per goal. */
      deficits: PlanResult['deficits']
    }
  | {
      kind: 'deficit'
      key: string
      goalId: string
      subjectId: string
      minutes: number
      /** "Dodaj X min dnevno" until the last learning day. */
      addPerDay: number
      until: LocalDate
      /** "Smanji obim": units to leave out, lowest priority first. */
      cut: CutUnit[]
    }
  | {
      kind: 'behind'
      key: string
      subjectId: string
      behindMinutes: number
      actions: BehindAction[]
    }
  | { kind: 'target_grade'; key: string; subjectId: string; priority: number }
  | { kind: 'exam_period'; key: string; periodId: string; until: LocalDate; capMin: number }
  | { kind: 'campaign_soon'; key: string; subjectId: string; start: LocalDate; days: number }
  /** "Znanje slabi": checks due today that are not in today's plan (over the review cap). */
  | { kind: 'check'; key: string; unitIds: string[]; minutes: number }

export type BehindAction =
  | { kind: 'raise_priority'; priority: number }
  | { kind: 'switch_to_regular' }
  | { kind: 'take_time_from'; donorId: string; minutesPerDay: number; until: LocalDate }
  | { kind: 'start_earlier'; start: LocalDate }
  | { kind: 'add_minutes'; minutesPerDay: number; until: LocalDate }

export interface SubjectBehindInput {
  subjectId: string
  behindMinutes: number
  /** From `paceActions()` (order and at most 3). */
  actions: PaceAction[]
}

export interface SuggestionInput {
  state: PlanState
  result: PlanResult
  today: LocalDate
  behind: SubjectBehindInput[]
  /** Subjects whose target grade is out of reach or needs > 90% at priority < 4. */
  targetGrade: string[]
  examPeriods: { id: string; startsOn: LocalDate; endsOn: LocalDate }[]
  /** Missed (not done, not skipped) planned days in a row, up to yesterday. */
  missedStreak: number
  /** Total deficit of the previous plan; null when there was none to compare. */
  previousDeficit: number | null
}

/** Exam-period cap suggested on Danas ("povećati maksimum na 6 h"). */
export const EXAM_PERIOD_CAP = 360
const SOON_DAYS = 3
/** Deficit grew by more than this since the last plan: fresh start instead of deficit cards. */
const DEFICIT_GROWTH_MIN = 60

const roundUp = (x: number, step: number) => Math.ceil(x / step) * step

/** Minutes a day to add so `minutes` fit the planned days from `from` to `until` (inclusive). */
export function addPerDay(state: PlanState, minutes: number, until: LocalDate): number {
  const n = state.days.filter((d) => d.date <= until && d.slots.length > 0).length
  if (n === 0) return roundUp(minutes, 15)
  return Math.max(15, roundUp(minutes / (n * state.rho * RESERVE), 15))
}

/**
 * "Smanji obim": required units of goals up to the deficit's goal, lowest priority first, then
 * the least important (fewest exam questions, easiest, latest in the outline), until they cover
 * the deficit.
 */
export function cutCandidates(state: PlanState, goalId: string, minutes: number): CutUnit[] {
  const goal = state.goals.find((g) => g.id === goalId)
  if (!goal) return []
  const goals = new Map(state.goals.map((g) => [g.id, g]))
  const subjects = new Map(state.subjects.map((s) => [s.id, s]))
  const units = new Map(state.units.map((u) => [u.id, u]))
  const pool = remainingWork(state)
    .filter((w) => w.unitId !== null && !w.optional && goals.get(w.goalId)!.on <= goal.on)
    .sort((a, b) => {
      const pa = subjects.get(a.subjectId)?.priority ?? 3
      const pb = subjects.get(b.subjectId)?.priority ?? 3
      const ua = units.get(a.unitId!)!
      const ub = units.get(b.unitId!)!
      return (
        pa - pb ||
        ua.questionCount - ub.questionCount ||
        ua.difficulty - ub.difficulty ||
        ub.order - ua.order ||
        (a.unitId! < b.unitId! ? -1 : 1)
      )
    })
  const out: CutUnit[] = []
  let acc = 0
  for (const w of pool) {
    if (acc >= minutes) break
    out.push({ unitId: w.unitId!, goalId: w.goalId, subjectId: w.subjectId, minutes: w.minutes })
    acc += w.minutes
  }
  return out
}

/** Days over which a boost's effect is measured ("X min dnevno"): the next week at most. */
const EFFECT_DAYS = 7

/**
 * "Uzmi vrijeme od [predmet]": the plan with and without a boost until `until`, compared over the
 * next week (or until the boost ends); the donor is the subject that loses the most minutes, and
 * the subject gains this many minutes a day.
 */
export function boostEffect(
  state: PlanState,
  subjectId: string,
  until: LocalDate,
): { donorId: string; minutesPerDay: number } | null {
  const boosted: PlanState = {
    ...state,
    subjects: state.subjects.map((s) => (s.id === subjectId ? { ...s, boostUntil: until } : s)),
  }
  const last = [until, addDays(state.from, EFFECT_DAYS - 1)].sort()[0]!
  const sum = (r: PlanResult) => {
    const out = new Map<string, number>()
    for (const b of r.blocks)
      if (b.onDate <= last) out.set(b.subjectId, (out.get(b.subjectId) ?? 0) + b.minutes)
    return out
  }
  const before = sum(plan(state))
  const after = sum(plan(boosted))
  const gain = (after.get(subjectId) ?? 0) - (before.get(subjectId) ?? 0)
  if (gain <= 0) return null
  let donor: string | null = null
  let loss = 0
  for (const s of [...state.subjects].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (s.id === subjectId) continue
    const delta = (after.get(s.id) ?? 0) - (before.get(s.id) ?? 0)
    if (delta < loss) {
      loss = delta
      donor = s.id
    }
  }
  if (!donor) return null
  const days = state.days.filter((d) => d.date <= last && d.slots.length > 0).length || 1
  return { donorId: donor, minutesPerDay: Math.max(5, Math.round(gain / days / 5) * 5) }
}

/** Next unpassed exam of a subject from `today` on. */
function nextExam(state: PlanState, subjectId: string, today: LocalDate) {
  return [...state.goals]
    .filter((g) => g.subjectId === subjectId && g.kind === 'exam' && g.on >= today)
    .sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : a.id < b.id ? -1 : 1))[0]
}

export function suggestions(input: SuggestionInput): Suggestion[] {
  const { state, result, today } = input
  const out: Suggestion[] = []
  const subjects = new Map(state.subjects.map((s) => [s.id, s]))
  const goals = new Map(state.goals.map((g) => [g.id, g]))

  const total = result.deficits.reduce((s, d) => s + d.minutes, 0)
  const grew =
    input.previousDeficit !== null &&
    total > 0 &&
    total - input.previousDeficit > DEFICIT_GROWTH_MIN
  if (input.missedStreak >= 2 || grew) {
    out.push({ kind: 'fresh_start', key: `fresh:${today}`, deficits: result.deficits })
  } else {
    for (const d of result.deficits) {
      out.push({
        kind: 'deficit',
        key: `deficit:${d.goalId}`,
        goalId: d.goalId,
        subjectId: d.subjectId,
        minutes: d.minutes,
        addPerDay: addPerDay(state, d.minutes, d.lastDay),
        until: d.lastDay,
        cut: cutCandidates(state, d.goalId, d.minutes),
      })
    }
  }

  for (const b of input.behind) {
    const subject = subjects.get(b.subjectId)
    if (!subject || b.actions.length === 0) continue
    const exam = nextExam(state, b.subjectId, today)
    const actions: BehindAction[] = []
    for (const a of b.actions) {
      if (a === 'raise_priority' && subject.priority < 5)
        actions.push({ kind: 'raise_priority', priority: subject.priority + 1 })
      else if (a === 'switch_to_regular' && subject.mode === 'campaign')
        actions.push({ kind: 'switch_to_regular' })
      else if (a === 'take_time_from' && exam) {
        const until = addDays(exam.on, -1)
        const effect = boostEffect(state, b.subjectId, until)
        if (effect) actions.push({ kind: 'take_time_from', ...effect, until })
      } else if (a === 'start_earlier') {
        const computed = result.computedStarts[b.subjectId]
        const current = result.campaignStarts[b.subjectId]
        if (computed && current && computed < current)
          actions.push({ kind: 'start_earlier', start: computed })
      } else if (a === 'add_minutes' && exam) {
        const until = addDays(exam.on, -1)
        actions.push({
          kind: 'add_minutes',
          minutesPerDay: addPerDay(state, b.behindMinutes, until),
          until,
        })
      }
    }
    if (actions.length > 0)
      out.push({
        kind: 'behind',
        key: `behind:${b.subjectId}`,
        subjectId: b.subjectId,
        behindMinutes: b.behindMinutes,
        actions: actions.slice(0, 3),
      })
  }

  for (const id of [...input.targetGrade].sort()) {
    const subject = subjects.get(id)
    if (subject && subject.priority < 4)
      out.push({
        kind: 'target_grade',
        key: `grade:${id}`,
        subjectId: id,
        priority: Math.max(4, subject.priority + 1),
      })
  }

  for (const p of [...input.examPeriods].sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1))) {
    const startsSoon = p.startsOn >= today && diffDays(today, p.startsOn) <= SOON_DAYS
    const lowCap = state.days.some(
      (d) => d.date >= p.startsOn && d.date <= p.endsOn && d.cap < EXAM_PERIOD_CAP,
    )
    if (startsSoon && lowCap)
      out.push({
        kind: 'exam_period',
        key: `period:${p.id}`,
        periodId: p.id,
        until: p.endsOn,
        capMin: EXAM_PERIOD_CAP,
      })
  }

  for (const [id, start] of Object.entries(result.campaignStarts).sort(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    const days = diffDays(today, start)
    if (days > 0 && days <= SOON_DAYS)
      out.push({
        kind: 'campaign_soon',
        key: `campaign:${id}:${start}`,
        subjectId: id,
        start,
        days,
      })
  }

  // Checks due but not in today's blocks: over the review share, or due since the plan was made.
  const planned = new Set(
    [...result.blocks, ...state.fixed]
      .filter((b) => b.onDate === today)
      .flatMap((b) => b.units.map((u) => u.unitId)),
  )
  const upcoming = new Set(
    state.goals.filter((g) => g.kind === 'exam' && g.on > today).flatMap((g) => g.unitIds),
  )
  const due = state.units.filter(
    (u) =>
      u.nextReviewOn !== null &&
      u.nextReviewOn <= today &&
      (u.level >= 1 || u.kind === 'question') &&
      upcoming.has(u.id) &&
      !planned.has(u.id),
  )
  if (due.length > 0)
    out.push({
      kind: 'check',
      key: `check:${today}`,
      unitIds: due.map((u) => u.id),
      minutes: due.reduce((sum, u) => sum + reviewMinutes(u.kind, u.minutes), 0),
    })

  const rank: Record<Suggestion['kind'], number> = {
    fresh_start: 0,
    deficit: 1,
    behind: 2,
    target_grade: 3,
    exam_period: 4,
    campaign_soon: 5,
    check: 6,
  }
  const goalOn = (s: Suggestion) => (s.kind === 'deficit' ? (goals.get(s.goalId)?.on ?? '') : '')
  const weight = (s: Suggestion) =>
    'subjectId' in s ? -priorityRule(subjects.get(s.subjectId)?.priority ?? 3).weight : 0
  return out.sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] ||
      (goalOn(a) < goalOn(b) ? -1 : goalOn(a) > goalOn(b) ? 1 : 0) ||
      weight(a) - weight(b) ||
      (a.key < b.key ? -1 : 1),
  )
}

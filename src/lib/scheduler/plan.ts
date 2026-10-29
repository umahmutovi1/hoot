import { addDays, diffDays, weekdayOf, type LocalDate } from '@/lib/day'
import { retrievabilityOn } from '@/lib/srs'
import { slotMinutes, type Slot } from '@/lib/schedule'
import { PART_RANGES, SLOT_PARTS } from '@/lib/schedule/rhythm'
import { planIntervalMin } from '@/lib/session/timer'
import {
  BOOST_WEIGHT,
  CAMPAIGN_MARGIN,
  CAMPAIGN_MIN_MARGIN_DAYS,
  priorityRule,
  RECAP_MINUTES,
  RESERVE,
  RHO_MAX,
  RHO_MIN,
  reviewMinutes,
  TARGET_MARGIN,
  workShare,
} from './constants'
import { reservedDays } from './eve'
import { placeTimes, type PlaceItem } from './place'
import { growthLimit } from './realization'
import type {
  BlockKind,
  BlockUnit,
  Deficit,
  PlanGoal,
  PlannedBlock,
  PlanResult,
  PlanState,
  PlanSubject,
  PlanUnit,
  Reason,
} from './types'

/**
 * `plan(state)` (PRD "Scheduler, replan i AI strategist" → Algoritam). Day by day from
 * `state.from`:
 *
 * 1. Capacity = min(free, cap) × ρ × 0.9 − fixed (manual) blocks; AI minutes also stay under
 *    the growth limit (a ramp from 1.25 × the 7-day average).
 * 2. Reviews due (`next_review_on`) first, at most `reviewCapPct` of the day, plus a recap after
 *    a lecture; then review / questions in the buffer days before an exam.
 * 3. Learning: each subject's urgency = Σ remaining work / capacity until the goal × priority
 *    weight (× 1.3 while boosted), the day is split by urgency among the top N subjects into
 *    blocks of whole study intervals; optional work (beyond target coverage) only fills what is
 *    left. Units covered in class have a soft deadline that raises urgency but never makes a
 *    deficit.
 * 4. `placeTimes()` puts the day's blocks into free slots with breaks; what does not fit stays
 *    in the pool for later days.
 *
 * A reserved day before an exam ("Dan pred ispit") holds only that subject: its reviews,
 * questions and weakest units of the scope; other subjects' work and capacity skip the day, and
 * a review that would land there before its own exam comes a day earlier.
 *
 * Campaign subjects (and, for subjects that track lectures, material not covered in class yet)
 * enter rotation on an ALAP start computed from a first pass. Remaining required work at the
 * last day before a goal is its deficit. Pure and deterministic.
 */

interface Work {
  /** Unit id, or the goal id for a deadline. */
  id: string
  unit: PlanUnit | null
  subjectId: string
  goal: PlanGoal
  /** Work at the start of the plan (for page ranges). */
  total: number
  left: number
  optional: boolean
  softDue: LocalDate | null
  /** Tracked material not covered in class: enters with its group's ALAP start. */
  late: boolean
}

interface Draft {
  subjectId: string
  goal: PlanGoal | null
  kind: BlockKind
  /** Work picked for the block, in order; consumed only as far as the block is placed. */
  picks: { work: Work | null; unit: PlanUnit | null; minutes: number }[]
  minutes: number
  optional: boolean
  reason: Reason
  demand: number
  /** Units reviewed by this block (marked once it is placed). */
  reviews: string[]
}

interface Pass {
  blocks: PlannedBlock[]
  works: Work[]
  used: Map<LocalDate, number>
  fixedTimes: Map<string, number>
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const byGoal = (a: PlanGoal, b: PlanGoal) => (a.on < b.on ? -1 : a.on > b.on ? 1 : byId(a, b))

export function bufferDaysOf(state: PlanState, subject: PlanSubject | undefined): number {
  return state.settings.bufferDays + (subject ? priorityRule(subject.priority).extraBuffer : 0)
}

/** First day without learning for the goal (exam − buffer; deadline: its due date). */
export function learnEndOf(state: PlanState, goal: PlanGoal, subject?: PlanSubject): LocalDate {
  if (goal.kind === 'deadline') return goal.on
  return addDays(goal.on, -bufferDaysOf(state, subject))
}

/** Required share of the scope: priority table, raised by the target grade (needed + 10 p.p.). */
export function coverageOf(subject: PlanSubject): number {
  const own = priorityRule(subject.priority).coverage
  if (subject.requiredShare === null) return own
  return Math.max(own, Math.min(1, subject.requiredShare + TARGET_MARGIN))
}

export const isWeekendDay = (date: LocalDate) => weekdayOf(date) >= 5

/** Expected done share of a day's free time by the completion model (minute-weighted); null without it. */
function slotShare(state: PlanState, date: LocalDate, slots: Slot[]): number | null {
  const table = state.slotCompletion?.[isWeekendDay(date) ? 'weekend' : 'weekday']
  if (!table) return null
  let minutes = 0
  let done = 0
  for (const s of slots)
    for (const part of SLOT_PARTS) {
      const r = PART_RANGES[part]
      const m = Math.max(0, Math.min(s.endMin, r.endMin) - Math.max(s.startMin, r.startMin))
      minutes += m
      done += m * table[part]
    }
  return minutes > 0 ? done / minutes : null
}

/**
 * Done share each planned day is expected to realize: ρ, shaped per day by the completion model
 * (a day of better slots gets more, a day of worse ones less, the mean over the horizon stays ρ),
 * clamped as ρ is.
 */
export function dayRealization(state: PlanState): number[] {
  const shares = state.days.map((d) => slotShare(state, d.date, d.slots))
  const known = shares.filter((x): x is number => x !== null)
  if (known.length === 0) return state.days.map(() => state.rho)
  const mean = known.reduce((s, x) => s + x, 0) / known.length
  return shares.map((x) =>
    x === null ? state.rho : Math.min(RHO_MAX, Math.max(RHO_MIN, (state.rho * x) / mean)),
  )
}

/**
 * AI minutes a day can take: min(free, cap) × expected done share × reserve, minus fixed blocks
 * of that day. The share is ρ, or per slot from the completion model (`dayRealization()`).
 */
export function aiCapacity(state: PlanState): number[] {
  const fixedOn = new Map<LocalDate, number>()
  for (const b of state.fixed) fixedOn.set(b.onDate, (fixedOn.get(b.onDate) ?? 0) + b.minutes)
  const share = dayRealization(state)
  return state.days.map((d, k) =>
    Math.max(
      0,
      Math.floor(Math.min(slotMinutes(d.slots), d.cap) * share[k]! * RESERVE) -
        (fixedOn.get(d.date) ?? 0),
    ),
  )
}

/**
 * Last day a review may fall on before an exam: the first buffer day, or the day before the exam
 * without a buffer; never before the first planned day.
 */
export function lastReviewDay(goal: PlanGoal, learnEnd: LocalDate, from: LocalDate): LocalDate {
  const last = learnEnd < goal.on ? learnEnd : addDays(goal.on, -1)
  return last < from ? from : last
}

/** Exam goals of each unit (the earliest one owns it). */
function ownerOf(goals: PlanGoal[]): Map<string, PlanGoal> {
  const owner = new Map<string, PlanGoal>()
  for (const g of goals) {
    if (g.kind !== 'exam') continue
    for (const id of g.unitIds) if (!owner.has(id)) owner.set(id, g)
  }
  return owner
}

/**
 * Units ranked by importance (exam questions through topics, then difficulty, then order); the
 * ones inside the target coverage are required, the rest optional.
 */
function requiredUnits(units: PlanUnit[], coverage: number): Set<string> {
  const ranked = [...units].sort(
    (a, b) =>
      b.questionCount - a.questionCount ||
      b.difficulty - a.difficulty ||
      a.order - b.order ||
      byId(a, b),
  )
  const total = ranked.reduce((s, u) => s + u.minutes, 0)
  const out = new Set<string>()
  let acc = 0
  for (const u of ranked) {
    if (acc >= coverage * total - 1e-9 && out.size > 0) break
    out.add(u.id)
    acc += u.minutes
  }
  return out
}

/** Order inside a goal: soft deadlines first, then re-learning (low confidence first), then outline. */
function workOrder(a: Work, b: Work): number {
  const sa = a.softDue ?? '9999-12-31'
  const sb = b.softDue ?? '9999-12-31'
  if (sa !== sb) return sa < sb ? -1 : 1
  const ra = a.unit && a.unit.level > 0 ? 0 : 1
  const rb = b.unit && b.unit.level > 0 ? 0 : 1
  if (ra !== rb) return ra - rb
  if (ra === 0) {
    const ca = a.unit?.confidence ?? 99
    const cb = b.unit?.confidence ?? 99
    if (ca !== cb) return ca - cb
    const qa = a.unit?.questionCount ?? 0
    const qb = b.unit?.questionCount ?? 0
    if (qa !== qb) return qb - qa
  }
  return (a.unit?.order ?? 0) - (b.unit?.order ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

function buildWorks(state: PlanState): Work[] {
  const subjects = new Map(state.subjects.map((s) => [s.id, s]))
  const units = new Map(state.units.map((u) => [u.id, u]))
  const goals = [...state.goals].sort(byGoal)
  const owner = ownerOf(goals)

  const reserved = new Map<string, number>()
  const reservedGoal = new Map<string, number>()
  for (const b of state.fixed) {
    for (const u of b.units) reserved.set(u.unitId, (reserved.get(u.unitId) ?? 0) + u.minutes)
    if (b.goalId && b.units.length === 0)
      reservedGoal.set(b.goalId, (reservedGoal.get(b.goalId) ?? 0) + b.minutes)
  }

  const works: Work[] = []
  for (const goal of goals) {
    const subject = subjects.get(goal.subjectId)
    if (!subject) continue
    if (goal.kind === 'deadline') {
      const left = Math.round(goal.minutes - (reservedGoal.get(goal.id) ?? 0))
      if (left > 0)
        works.push({
          id: goal.id,
          unit: null,
          subjectId: goal.subjectId,
          goal,
          total: left,
          left,
          optional: false,
          softDue: null,
          late: false,
        })
      continue
    }
    const own = goal.unitIds
      .filter((id) => owner.get(id) === goal)
      .map((id) => units.get(id))
      .filter((u): u is PlanUnit => Boolean(u))
    const required = requiredUnits(own, coverageOf(subject))
    for (const unit of own) {
      const left = Math.round(
        // A partly read unit only needs the rest (Stage 10b: reading continues where it stopped).
        unit.minutes * workShare(unit.kind, unit.level) * (1 - readOf(unit)) -
          (reserved.get(unit.id) ?? 0),
      )
      if (left <= 0) continue
      const regular = subject.mode === 'regular'
      works.push({
        id: unit.id,
        unit,
        subjectId: subject.id,
        goal,
        total: left,
        left,
        optional: !required.has(unit.id),
        softDue:
          regular && unit.tracked && unit.coveredOn
            ? addDays(unit.coveredOn, state.settings.lecturePaceDays)
            : null,
        late: regular && unit.tracked && !unit.coveredOn,
      })
    }
  }
  return works.sort((a, b) => byGoal(a.goal, b.goal) || workOrder(a, b))
}

export interface RemainingWork {
  unitId: string | null
  goalId: string
  subjectId: string
  minutes: number
  optional: boolean
}

/** Work left per unit (and deadline) at the start of the plan, owned by the earliest goal. */
export function remainingWork(state: PlanState): RemainingWork[] {
  return buildWorks(state).map((w) => ({
    unitId: w.unit?.id ?? null,
    goalId: w.goal.id,
    subjectId: w.subjectId,
    minutes: w.left,
    optional: w.optional,
  }))
}

/** Share of a not yet read unit that is already read (0 for a unit past "Pročitano"). */
function readOf(unit: PlanUnit): number {
  return unit.level === 0 ? Math.min(1, Math.max(0, unit.readShare ?? 0)) : 0
}

/** Page range of `minutes` of a unit's work, starting after what earlier blocks took. */
function pagesOf(work: Work, minutes: number): Pick<BlockUnit, 'pageFrom' | 'pageTo'> {
  const u = work.unit
  if (!u || u.pageStart === null || u.pageEnd === null || u.pageEnd < u.pageStart || u.level > 0)
    return { pageFrom: u?.pageStart ?? null, pageTo: u?.pageEnd ?? null }
  const pages = u.pageEnd - u.pageStart + 1
  // Pages already read come first; the work covers the rest of the unit.
  const read = readOf(u)
  const before = read + ((1 - read) * (work.total - work.left)) / work.total
  const after = read + ((1 - read) * (work.total - work.left + minutes)) / work.total
  const from = u.pageStart + Math.min(pages - 1, Math.floor(before * pages + 1e-9))
  const to = u.pageStart + Math.max(0, Math.ceil(after * pages - 1e-9) - 1)
  return { pageFrom: from, pageTo: Math.max(from, Math.min(u.pageEnd, to)) }
}

/**
 * Integer split of `total` by weight, each share capped; residual minutes go to the highest
 * weights first.
 */
function waterfill(
  total: number,
  list: { id: string; w: number; cap: number }[],
): Map<string, number> {
  const out = new Map(list.map((x) => [x.id, 0]))
  let active = list.filter((x) => x.cap > 0 && x.w > 0)
  let remaining = total
  for (;;) {
    const W = active.reduce((s, x) => s + x.w, 0)
    if (remaining <= 0 || W <= 0) break
    const saturated = active.filter((x) => x.cap - out.get(x.id)! <= (remaining * x.w) / W)
    if (saturated.length === 0) {
      let given = 0
      for (const x of active) {
        const share = Math.floor((remaining * x.w) / W)
        out.set(x.id, out.get(x.id)! + share)
        given += share
      }
      let rest = remaining - given
      for (const x of active) {
        if (rest <= 0) break
        if (out.get(x.id)! < x.cap) {
          out.set(x.id, out.get(x.id)! + 1)
          rest--
        }
      }
      break
    }
    for (const x of saturated) {
      remaining -= x.cap - out.get(x.id)!
      out.set(x.id, x.cap)
    }
    active = active.filter((x) => !saturated.includes(x))
  }
  return out
}

function run(
  state: PlanState,
  starts: Map<string, LocalDate>,
  groupStarts: Map<string, LocalDate>,
): Pass {
  const { settings, preset } = state
  const subjects = new Map(state.subjects.map((s) => [s.id, s]))
  const units = new Map(state.units.map((u) => [u.id, u]))
  const goals = [...state.goals].sort(byGoal)
  const works = buildWorks(state)
  const interval = planIntervalMin(preset)
  const minBlock = settings.minBlockMinutes

  const learnEnd = new Map(
    goals.map((g) => [g.id, learnEndOf(state, g, subjects.get(g.subjectId))]),
  )
  const dayIndex = new Map(state.days.map((d, i) => [d.date, i]))

  const aiCap = aiCapacity(state)
  const effCap = aiCap.map((c, k) => Math.min(c, growthLimit(state.growthBase, k)))
  const prefix = [0]
  for (const c of effCap) prefix.push(prefix[prefix.length - 1]! + c)
  const reserved = reservedDays(state)
  /** The day is reserved for another subject's exam. */
  const blockedFor = (d: LocalDate, subjectId: string) => {
    const owner = reserved.get(d)
    return owner !== undefined && owner.subjectId !== subjectId
  }
  /** Capacity from day k up to (not including) `end`, without days reserved for others. */
  const capUntil = (k: number, end: LocalDate, subjectId: string) => {
    const e = dayIndex.get(end) ?? (end > (state.days.at(-1)?.date ?? end) ? state.days.length : 0)
    if (e <= k) return 0
    let c = prefix[e]! - prefix[k]!
    for (const [d, owner] of reserved) {
      const i = dayIndex.get(d)
      if (i !== undefined && i >= k && i < e && owner.subjectId !== subjectId) c -= effCap[i]!
    }
    return c
  }

  const goalsOfUnit = new Map<string, PlanGoal[]>()
  for (const g of goals)
    if (g.kind === 'exam')
      for (const id of g.unitIds) goalsOfUnit.set(id, [...(goalsOfUnit.get(id) ?? []), g])

  const startOf = (w: Work): LocalDate | null => {
    const subject = subjects.get(w.subjectId)!
    if (subject.mode === 'campaign') return starts.get(subject.id) ?? null
    if (w.late) return groupStarts.get(w.goal.id) ?? null
    return state.from
  }
  const eligible = (w: Work, date: LocalDate) => {
    if (w.left <= 0) return false
    const start = startOf(w)
    return (
      start !== null &&
      date >= start &&
      date < learnEnd.get(w.goal.id)! &&
      !blockedFor(date, w.subjectId)
    )
  }

  // When each unit is due: its FSRS day, but never after the last day before its nearest exam
  // (first buffer day, or the day before the exam). FSRS puts the day where strength falls to the
  // target, so a unit due after that day would reach the exam under it: it gets its check then
  // (PRD "Cilj je jačina na dan ispita"). Applied here too because exams and buffers move.
  const dueOn = new Map<string, LocalDate>()
  for (const u of state.units) {
    if (u.nextReviewOn === null) continue
    const goal = (goalsOfUnit.get(u.id) ?? []).find((g) => g.on > state.from)
    let last = goal ? lastReviewDay(goal, learnEnd.get(goal.id)!, state.from) : null
    // A day reserved for another exam: the check comes earlier, never after its own exam.
    while (last !== null && last > state.from && blockedFor(last, u.subjectId))
      last = addDays(last, -1)
    dueOn.set(u.id, last !== null && u.nextReviewOn > last ? last : u.nextReviewOn)
  }

  const reviewed = new Set<string>()
  const blocks: PlannedBlock[] = []
  const used = new Map<LocalDate, number>()
  const fixedTimes = new Map<string, number>()

  state.days.forEach((day, k) => {
    const d = day.date
    const cap = aiCap[k]!
    const limit = growthLimit(state.growthBase, k)
    const drafts: Draft[] = []
    const weightOf = (s: PlanSubject) =>
      priorityRule(s.priority).weight * (s.boostUntil && d <= s.boostUntil ? BOOST_WEIGHT : 1)
    const flags = (s: PlanSubject) => ({
      ...(s.priority >= 5 ? { conditional: true as const } : {}),
      ...(s.boostUntil && d <= s.boostUntil ? { boost: true as const } : {}),
    })

    // 2. Reviews due and recaps, within the review share of the day. Over the cap, the closer
    // exam and then the lower strength go first; the rest moves to the next day.
    let reviewBudget = Math.min(Math.floor((cap * settings.reviewCapPct) / 100), limit)
    const strength = (u: PlanUnit) =>
      u.memory ? retrievabilityOn(u.memory, d, state.fsrsParams) : 0
    const due = state.units
      .filter((u) => {
        const on = dueOn.get(u.id)
        return (
          on !== undefined &&
          on <= d &&
          !reviewed.has(u.id) &&
          !blockedFor(d, u.subjectId) &&
          (goalsOfUnit.get(u.id) ?? []).some((g) => g.on > d)
        )
      })
      .sort((a, b) => {
        const ga = goalsOfUnit.get(a.id)!.find((g) => g.on > d)!.on
        const gb = goalsOfUnit.get(b.id)!.find((g) => g.on > d)!.on
        if (ga !== gb) return ga < gb ? -1 : 1
        const ra = strength(a)
        const rb = strength(b)
        if (ra !== rb) return ra - rb
        const da = dueOn.get(a.id)!
        const db = dueOn.get(b.id)!
        return da < db ? -1 : da > db ? 1 : a.order - b.order || byId(a, b)
      })
    const reviewDrafts = new Map<string, Draft>()
    for (const u of due) {
      const m = reviewMinutes(u.kind, u.minutes)
      if (m > reviewBudget) continue
      const subject = subjects.get(u.subjectId)
      if (!subject) continue
      let draft = reviewDrafts.get(u.subjectId)
      if (!draft) {
        const goal = goalsOfUnit.get(u.id)!.find((g) => g.on > d)!
        draft = {
          subjectId: u.subjectId,
          goal,
          kind: 'review',
          picks: [],
          minutes: 0,
          optional: false,
          reason: {
            code: 'review',
            goalId: goal.id,
            days: diffDays(d, goal.on),
            ...flags(subject),
          },
          demand: 0,
          reviews: [],
        }
        reviewDrafts.set(u.subjectId, draft)
        drafts.push(draft)
      }
      draft.picks.push({ work: null, unit: u, minutes: m })
      draft.minutes += m
      draft.reviews.push(u.id)
      reviewBudget -= m
    }
    if (settings.recapAfterLecture) {
      for (const sid of [...day.lectureSubjectIds].sort()) {
        const subject = subjects.get(sid)
        const goal = goals.find((g) => g.subjectId === sid && g.kind === 'exam' && g.on > d)
        if (!subject || !goal || reviewBudget < RECAP_MINUTES || blockedFor(d, sid)) continue
        const covered = state.units
          .filter((u) => u.subjectId === sid && u.coveredOn === d)
          .sort((a, b) => a.order - b.order || byId(a, b))
        const each = covered.length ? Math.max(1, Math.floor(RECAP_MINUTES / covered.length)) : 0
        drafts.push({
          subjectId: sid,
          goal,
          kind: 'recap',
          picks: covered
            .slice(0, RECAP_MINUTES)
            .map((u) => ({ work: null, unit: u, minutes: each })),
          minutes: RECAP_MINUTES,
          optional: false,
          reason: { code: 'recap', goalId: goal.id, date: d, ...flags(subject) },
          demand: 0,
          reviews: [],
        })
        reviewBudget -= RECAP_MINUTES
      }
    }
    const reviewUsed = drafts.reduce((s, x) => s + x.minutes, 0)

    // Buffer days: review and questions from the exam's scope only. The reserved day before an
    // exam is one too, and it may take the whole day, weakest units first.
    let bufferUsed = 0
    const eveOf = reserved.get(d)
    for (const g of goals) {
      if (g.kind !== 'exam') continue
      const end = learnEnd.get(g.id)!
      const eve = eveOf?.id === g.id
      if (!eve && !(d >= end && d < g.on)) continue
      if (blockedFor(d, g.subjectId)) continue
      const subject = subjects.get(g.subjectId)
      if (!subject) continue
      const pool = g.unitIds
        .map((id) => units.get(id))
        // The reserved day goes over the scope once more, also what was reviewed before.
        .filter((u): u is PlanUnit => Boolean(u) && (eve || !reviewed.has(u!.id)))
        .filter((u) => u.kind === 'question' || u.level >= 1)
        .filter((u) => !drafts.some((x) => x.reviews.includes(u.id)))
        .sort(
          (a, b) =>
            (eve ? strength(a) - strength(b) : 0) ||
            a.level - b.level ||
            b.difficulty - a.difficulty ||
            a.order - b.order ||
            byId(a, b),
        )
      if (pool.length === 0) continue
      const daysLeft = Math.max(1, diffDays(d, g.on))
      const total = pool.reduce((s, u) => s + reviewMinutes(u.kind, u.minutes), 0)
      let budget = Math.min(
        cap - reviewUsed - bufferUsed,
        eve ? total : Math.max(Math.min(total, minBlock), Math.ceil(total / daysLeft)),
      )
      const draft: Draft = {
        subjectId: g.subjectId,
        goal: g,
        kind: pool.some((u) => u.kind === 'question') ? 'questions' : 'review',
        picks: [],
        minutes: 0,
        optional: false,
        reason: { code: 'buffer', goalId: g.id, days: diffDays(d, g.on), ...flags(subject) },
        demand: 0.2,
        reviews: [],
      }
      for (const u of pool) {
        const m = reviewMinutes(u.kind, u.minutes)
        if (m > budget) break
        draft.picks.push({ work: null, unit: u, minutes: m })
        draft.minutes += m
        draft.reviews.push(u.id)
        budget -= m
      }
      if (draft.minutes > 0) {
        drafts.push(draft)
        bufferUsed += draft.minutes
      }
    }

    // 3. Learning by urgency.
    let L = Math.max(0, Math.min(cap - reviewUsed - bufferUsed, limit - reviewUsed))
    const chosen = new Set<string>()
    const allocate = (optional: boolean) => {
      if (L <= 0) return
      const pools = new Map<string, Work[]>()
      for (const w of works) {
        if (w.optional !== optional || !eligible(w, d)) continue
        pools.set(w.subjectId, [...(pools.get(w.subjectId) ?? []), w])
      }
      const urgency = new Map<string, number>()
      for (const [sid, list] of pools) {
        const subject = subjects.get(sid)!
        let u = 0
        const perGoal = new Map<string, number>()
        for (const w of list) perGoal.set(w.goal.id, (perGoal.get(w.goal.id) ?? 0) + w.left)
        for (const [gid, left] of perGoal) {
          const c = capUntil(k, learnEnd.get(gid)!, sid)
          u += c > 0 ? left / c : left
        }
        const soft = new Map<LocalDate, number>()
        for (const w of list)
          if (w.softDue) soft.set(w.softDue, (soft.get(w.softDue) ?? 0) + w.left)
        let acc = 0
        for (const [due, left] of [...soft].sort(([a], [b]) => (a < b ? -1 : 1))) {
          acc += left
          const c = capUntil(k, addDays(due, 1), sid)
          u = Math.max(u, c > 0 ? acc / c : acc)
        }
        urgency.set(sid, u * weightOf(subject))
      }
      const must = optional ? new Map<string, number>() : mustToday(k)
      const top: [string, number][] = []
      let room = settings.maxSubjectsPerDay - chosen.size
      const order = [...urgency].sort(
        ([a, ua], [b, ub]) =>
          Number((must.get(b) ?? 0) > 0) - Number((must.get(a) ?? 0) > 0) ||
          ub - ua ||
          (a < b ? -1 : 1),
      )
      for (const entry of order) {
        if (chosen.has(entry[0])) top.push(entry)
        else if (room > 0) {
          top.push(entry)
          room--
        }
      }
      if (top.length === 0) return
      const poolMinutes = (sid: string) => pools.get(sid)!.reduce((s, w) => s + w.left, 0)
      const shares = waterfill(
        L,
        top.map(([sid, u]) => ({ id: sid, w: Math.max(u, 1e-6), cap: poolMinutes(sid) })),
      )
      // Whole study intervals (50 + 50, not 70); a share below the minimum block is dropped
      // unless it finishes the subject's remaining work.
      let freed = 0
      for (const [sid] of top) {
        const s = shares.get(sid)!
        const p = poolMinutes(sid)
        if (s >= p) continue
        if (s >= interval) {
          const r = Math.floor(s / interval) * interval
          freed += s - r
          shares.set(sid, r)
        } else if (s < minBlock) {
          freed += s
          shares.set(sid, 0)
        }
      }
      for (const [sid] of top) {
        if (freed < minBlock) break
        const s = shares.get(sid)!
        const p = poolMinutes(sid)
        let add = Math.min(freed, p - s)
        if (s + add < p && add >= interval) add = Math.floor(add / interval) * interval
        if (add <= 0 || (s === 0 && add < minBlock && add < p)) continue
        shares.set(sid, s + add)
        freed -= add
      }
      // EDF guard: a subject gets at least what must be done today for the rest to still fit,
      // taken from unused minutes first, then from the least urgent subjects' extra.
      let spare = L - [...shares.values()].reduce((a, b) => a + b, 0)
      for (const [sid] of top) {
        const floor = Math.min(must.get(sid) ?? 0, poolMinutes(sid))
        let lack = floor - shares.get(sid)!
        if (lack <= 0) continue
        // Unused minutes only as a piece the day would keep (whole block or the subject's end).
        let gained = Math.min(lack, Math.max(0, spare))
        if (gained < minBlock && shares.get(sid)! + gained < poolMinutes(sid)) gained = 0
        spare -= gained
        lack -= gained
        for (const [other] of [...top].reverse()) {
          if (lack <= 0) break
          const own = shares.get(other)!
          const extra = own - (must.get(other) ?? 0)
          if (other === sid || extra <= 0) continue
          let give = Math.min(lack, extra)
          // A remainder below the minimum block is dropped, not left as a sliver.
          if (own - give > 0 && own - give < minBlock && extra === own) give = own
          shares.set(other, own - give)
          const taken = Math.min(give, lack)
          lack -= taken
          gained += taken
          spare += give - taken
        }
        shares.set(sid, shares.get(sid)! + gained)
      }
      for (const [sid] of top) {
        let share = shares.get(sid)!
        if (share <= 0) continue
        chosen.add(sid)
        L -= share
        const subject = subjects.get(sid)!
        const byGoalDraft = new Map<string, Draft>()
        for (const w of pools.get(sid)!) {
          if (share <= 0) break
          const m = Math.min(w.left - picked(w), share)
          if (m <= 0) continue
          let draft = byGoalDraft.get(w.goal.id)
          if (!draft) {
            draft = existingDraft(sid, w.goal.id) ?? newLearnDraft(w, subject, optional)
            byGoalDraft.set(w.goal.id, draft)
          }
          draft.picks.push({ work: w, unit: w.unit, minutes: m })
          draft.minutes += m
          if (!optional) draft.optional = false
          share -= m
        }
        L += share
      }
    }
    /**
     * Required minutes each subject must get today so that its goals still fit the later days
     * (ROADMAP 11a feasibility): later days are filled backwards, latest goal first, and what
     * does not fit is today's floor. Reviews and buffers of later days are not known here.
     */
    const mustToday = (k: number): Map<string, number> => {
      const open = new Map<string, { sid: string; left: number; first: number; last: number }>()
      for (const w of works) {
        const left = w.left - picked(w)
        if (w.optional || left <= 0 || !eligible(w, d)) continue
        const g = open.get(w.goal.id)
        if (g) g.left += left
        else {
          const start = startOf(w)
          open.set(w.goal.id, {
            sid: w.subjectId,
            left,
            first: start ? (dayIndex.get(start) ?? 0) : 0,
            last: (dayIndex.get(learnEnd.get(w.goal.id)!) ?? state.days.length) - 1,
          })
        }
      }
      const list = [...open.entries()].sort(([a, x], [b, y]) => y.last - x.last || (a < b ? -1 : 1))
      for (let j = state.days.length - 1; j > k; j--) {
        let room = effCap[j]!
        for (const [, g] of list) {
          if (room <= 0) break
          if (g.left <= 0 || g.last < j || g.first > j || blockedFor(state.days[j]!.date, g.sid))
            continue
          const take = Math.min(room, g.left)
          g.left -= take
          room -= take
        }
      }
      const out = new Map<string, number>()
      for (const [, g] of list)
        if (g.left > 0) out.set(g.sid, (out.get(g.sid) ?? 0) + Math.ceil(g.left))
      return out
    }
    const picked = (w: Work) =>
      drafts.reduce(
        (s, x) => s + x.picks.filter((p) => p.work === w).reduce((a, p) => a + p.minutes, 0),
        0,
      )
    const existingDraft = (sid: string, gid: string) =>
      drafts.find(
        (x) =>
          x.subjectId === sid &&
          x.goal?.id === gid &&
          (x.kind === 'learn' || x.kind === 'questions' || x.kind === 'deadline'),
      )
    const newLearnDraft = (w: Work, subject: PlanSubject, optional: boolean): Draft => {
      const g = w.goal
      const start = subject.mode === 'campaign' ? starts.get(subject.id) : undefined
      const reason: Reason =
        start === d
          ? { code: 'campaign_start', goalId: g.id, days: diffDays(d, g.on) }
          : w.softDue && w.unit?.coveredOn
            ? { code: 'lecture', goalId: g.id, date: w.unit.coveredOn, days: diffDays(d, g.on) }
            : optional
              ? { code: 'optional', goalId: g.id, days: diffDays(d, g.on) }
              : {
                  code: g.kind === 'deadline' ? 'deadline' : 'exam',
                  goalId: g.id,
                  days: diffDays(d, g.on),
                }
      const draft: Draft = {
        subjectId: subject.id,
        goal: g,
        kind: g.kind === 'deadline' ? 'deadline' : 'learn',
        picks: [],
        minutes: 0,
        optional,
        reason: { ...reason, ...flags(subject) },
        demand: 0,
        reviews: [],
      }
      drafts.push(draft)
      return draft
    }
    allocate(false)
    allocate(true)

    for (const x of drafts) {
      if (
        x.kind === 'learn' &&
        x.picks.length > 0 &&
        x.picks.every((p) => p.unit?.kind === 'question')
      )
        x.kind = 'questions'
      const learning = x.picks.filter((p) => p.unit)
      const first = learning.some((p) => (p.unit?.level ?? 0) === 0) ? 1 : 0.5
      const diff =
        learning.reduce((s, p) => s + (p.unit?.difficulty ?? 3), 0) / Math.max(1, learning.length)
      if (x.kind === 'learn' || x.kind === 'questions' || x.kind === 'deadline')
        x.demand = first + diff / 10
    }

    // 4. Times: fixed blocks stay, the rest goes into free slots with breaks.
    const fixedToday = state.fixed.filter((b) => b.onDate === d)
    const keyed = drafts
      .filter((x) => x.minutes > 0)
      .map((x, i) => ({ x, key: `${d}:${x.subjectId}:${x.goal?.id ?? '-'}:${x.kind}:${i}` }))
    const items: PlaceItem[] = [
      ...fixedToday.map((b) => ({
        key: `fixed:${b.id}`,
        minutes: b.minutes,
        kind: b.kind,
        demand: 1,
        fixedStart: b.startMin,
        manual: true,
      })),
      ...keyed.map(({ x, key }) => ({ key, minutes: x.minutes, kind: x.kind, demand: x.demand })),
    ]
    const examEve = goals.some((g) => g.kind === 'exam' && g.on === addDays(d, 1))
    const placed = placeTimes(items, {
      slots: day.slots,
      preset,
      minBlockMinutes: minBlock,
      preferredParts: state.preferredParts,
      scores: state.slotScores?.[isWeekendDay(d) ? 'weekend' : 'weekday'] ?? null,
      explore: state.explore?.find((e) => e.date === d)?.scores ?? null,
      notBefore: k === 0 ? state.nowMin : null,
      endBy: examEve ? settings.examEveEndMin : null,
    })
    for (const p of placed.placements)
      if (p.key.startsWith('fixed:') && p.part === 0) fixedTimes.set(p.key.slice(6), p.startMin)

    let usedToday = 0
    for (const { x, key } of keyed) {
      const parts = placed.placements.filter((p) => p.key === key).sort((a, b) => a.part - b.part)
      // Consume picks in order across the placed parts.
      let pickIndex = 0
      let pickUsed = 0
      for (const part of parts) {
        let room = part.minutes
        const blockUnits: BlockUnit[] = []
        while (room > 0 && pickIndex < x.picks.length) {
          const pick = x.picks[pickIndex]!
          const m = Math.min(pick.minutes - pickUsed, room)
          if (pick.work) {
            if (pick.unit)
              blockUnits.push({ unitId: pick.unit.id, minutes: m, ...pagesOf(pick.work, m) })
            pick.work.left -= m
          } else if (pick.unit) {
            blockUnits.push({
              unitId: pick.unit.id,
              minutes: m,
              pageFrom: pick.unit.pageStart,
              pageTo: pick.unit.pageEnd,
            })
            if (x.reviews.includes(pick.unit.id) && pickUsed + m >= pick.minutes)
              reviewed.add(pick.unit.id)
          }
          room -= m
          pickUsed += m
          if (pickUsed >= pick.minutes) {
            pickIndex++
            pickUsed = 0
          }
        }
        // Reviews and recaps keep their length; learning only counts the work it took.
        const minutes =
          x.kind === 'review' || x.kind === 'recap'
            ? part.minutes
            : part.minutes - Math.max(0, room)
        if (minutes <= 0) continue
        usedToday += minutes
        blocks.push({
          key: parts.length > 1 ? `${key}:${part.part}` : key,
          subjectId: x.subjectId,
          goalId: x.goal?.id ?? null,
          onDate: d,
          startMin: part.startMin,
          minutes,
          kind: x.kind,
          optional: x.optional,
          units: mergeUnits(blockUnits),
          reason: x.reason,
          demand: x.demand,
        })
      }
    }
    used.set(d, usedToday)
  })

  return { blocks, works, used, fixedTimes }
}

function mergeUnits(list: BlockUnit[]): BlockUnit[] {
  const out: BlockUnit[] = []
  for (const u of list) {
    const last = out.find((x) => x.unitId === u.unitId)
    if (last) {
      last.minutes += u.minutes
      last.pageFrom =
        last.pageFrom === null ? u.pageFrom : Math.min(last.pageFrom, u.pageFrom ?? last.pageFrom)
      last.pageTo = last.pageTo === null ? u.pageTo : Math.max(last.pageTo, u.pageTo ?? last.pageTo)
    } else out.push({ ...u })
  }
  return out
}

/**
 * ALAP start of late work (PRD "Start kampanje"): walking back from the last learning day, take
 * the capacity a first pass left free until the group's required work fits, then add a margin
 * of 20% of the work (at least 2 days). Earlier goals reserve their capacity first.
 */
function alapStarts(state: PlanState, first: Pass) {
  const subjects = new Map(state.subjects.map((s) => [s.id, s]))
  const goals = [...state.goals].sort(byGoal)
  const free = new Map(state.days.map((d) => [d.date, 0]))
  aiCapacity(state).forEach((cap, k) => {
    const d = state.days[k]!.date
    free.set(
      d,
      Math.max(0, Math.min(cap, growthLimit(state.growthBase, k)) - (first.used.get(d) ?? 0)),
    )
  })
  const dates = state.days.map((d) => d.date)
  const reserved = reservedDays(state)
  const campaign = new Map<string, LocalDate>()
  const late = new Map<string, LocalDate>()

  // Free capacity a subject can take: none on a day reserved for another subject's exam.
  const freeFor = (d: LocalDate, sid: string) => {
    const owner = reserved.get(d)
    return owner && owner.subjectId !== sid ? 0 : free.get(d)!
  }
  const walk = (work: number, end: LocalDate, sid: string): LocalDate => {
    let i = dates.findIndex((d) => d >= end)
    if (i < 0) i = dates.length
    i -= 1
    if (i < 0) return state.from
    if (work <= 0) return dates[i]!
    let acc = 0
    let start: number | null = null
    for (let j = i; j >= 0; j--) {
      const d = dates[j]!
      const take = Math.min(freeFor(d, sid), work - acc)
      free.set(d, free.get(d)! - take)
      acc += take
      if (acc >= work) {
        start = j
        break
      }
    }
    if (start === null) return state.from
    const margin = work * CAMPAIGN_MARGIN
    let extra = 0
    let days = 0
    let j = start
    const cap = (d: LocalDate) => freeFor(d, sid)
    while (j > 0 && (extra < margin || days < CAMPAIGN_MIN_MARGIN_DAYS)) {
      j--
      extra += cap(dates[j]!)
      days++
    }
    return dates[j]!
  }

  for (const g of goals) {
    const subject = subjects.get(g.subjectId)
    if (!subject) continue
    const end = learnEndOf(state, g, subject)
    const required = first.works
      .filter((w) => w.goal === g || w.goal.id === g.id)
      .filter((w) => !w.optional)
    if (subject.mode === 'campaign') {
      const start = walk(
        required.reduce((s, w) => s + w.left, 0),
        end,
        subject.id,
      )
      const prev = campaign.get(subject.id)
      if (!prev || start < prev) campaign.set(subject.id, start)
    } else {
      const lateWork = required.filter((w) => w.late)
      if (lateWork.length === 0) continue
      late.set(
        g.id,
        walk(
          lateWork.reduce((s, w) => s + w.left, 0),
          end,
          subject.id,
        ),
      )
    }
  }
  return { campaign, late }
}

export function plan(state: PlanState): PlanResult {
  const first = run(state, new Map(), new Map())
  const computed = alapStarts(state, first)
  const starts = new Map<string, LocalDate>()
  for (const s of state.subjects) {
    if (s.mode !== 'campaign') continue
    const start = s.campaignStartOn ?? computed.campaign.get(s.id)
    if (start) starts.set(s.id, start < state.from ? state.from : start)
  }
  const final = run(state, starts, computed.late)

  const subjects = new Map(state.subjects.map((s) => [s.id, s]))
  const deficits: Deficit[] = []
  const left = new Map<string, number>()
  for (const w of final.works)
    if (!w.optional) left.set(w.goal.id, (left.get(w.goal.id) ?? 0) + w.left)
  for (const g of [...state.goals].sort(byGoal)) {
    const minutes = Math.round(left.get(g.id) ?? 0)
    if (minutes <= 0) continue
    deficits.push({
      goalId: g.id,
      subjectId: g.subjectId,
      minutes,
      lastDay: addDays(learnEndOf(state, g, subjects.get(g.subjectId)), -1),
    })
  }

  const capacity: Record<LocalDate, number> = {}
  aiCapacity(state).forEach((c, k) => (capacity[state.days[k]!.date] = c))

  const blocks = [...final.blocks].sort(
    (a, b) =>
      (a.onDate < b.onDate ? -1 : a.onDate > b.onDate ? 1 : 0) ||
      (a.startMin ?? 9999) - (b.startMin ?? 9999) ||
      (a.key < b.key ? -1 : 1),
  )
  return {
    blocks,
    deficits,
    campaignStarts: Object.fromEntries([...starts].sort(([a], [b]) => (a < b ? -1 : 1))),
    computedStarts: Object.fromEntries(
      [...computed.campaign]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([id, d]) => [id, d < state.from ? state.from : d]),
    ),
    capacity,
    fixedTimes: Object.fromEntries([...final.fixedTimes].sort(([a], [b]) => (a < b ? -1 : 1))),
  }
}

import { addDays, localDay, wallClock, type DayBoundary, type LocalDate } from '@/lib/day'
import { questionsByChapter } from '@/lib/questions/links'
import { project, retakeStatus } from '@/lib/grades'
import {
  coveredLeaves,
  paceActions,
  reachedLogs,
  sourcePace,
  subjectBehind,
  type PaceLog,
  type PaceUnit,
  type SourcePace,
} from '@/lib/pace'
import { leavesOf } from '@/lib/progress'
import { scopeOf, type ScopeRow } from '@/lib/progress/scope'
import { capFor, classesOn, freeSlotsOn, type DayInput } from '@/lib/schedule'
import { SLOT_PARTS, type SlotPart } from '@/lib/schedule/rhythm'
import {
  growthBase,
  realization,
  type SubjectBehindInput,
  type DayHistory,
  type FixedBlock,
  type PlanDay,
  type PlanGoal,
  type PlanState,
  type PlanSubject,
  type PlanUnit,
} from '@/lib/scheduler'
import { resolvePreset, type CustomPresetRow } from '@/lib/session/timer'
import type { CompletionPosterior } from '@/lib/slots/completion'
import { exploreDays, slotCompletion, slotScores } from '@/lib/slots/score'
import { paramsOf } from '@/lib/srs/optimize'
import type { Tables } from '@/types/database'
import {
  asProgress,
  materialOf,
  rateOf,
  toScopeRows,
  type AssessmentUnit,
  type SourceWithUnits,
} from '@/features/sources/model'
import { gradeItemsOf, gradeSubjectOf } from '@/features/subjects/grades'
import type { Assessment, Deadline, SubjectWithAssessments } from '@/features/subjects/model'
import type { LectureLogRow } from '@/features/schedule/model'
import { parseCustomPresets } from '@/features/session/presets'
import { memoryOf, type MemoryRow } from '@/features/review/memory'

/**
 * Database rows → `PlanState` (PRD "Scheduler"). Everything the plan depends on passes through
 * here, so the state (and its hash) changes exactly when an input changes.
 */

export type Profile = Tables<'profiles'>
export type PlanBlockRow = Tables<'plan_blocks'> & {
  plan_block_units: Tables<'plan_block_units'>[]
}

/** Minutes studied in one session, for ρ and the growth limit. */
export interface SessionMinutes {
  startedAt: string
  blockId: string | null
  minutes: number
}

/** A card's review columns (its due day joins its unit's review). */
export type CardReview = Pick<Tables<'cards'>, 'id' | 'unit_id' | 'next_review_on'> & MemoryRow

export interface PlanInputs {
  profile: Profile
  subjects: SubjectWithAssessments[]
  deadlines: Deadline[]
  sources: SourceWithUnits[]
  scope: AssessmentUnit[]
  /** unit ↔ topic links of every subject. */
  unitTopics: { unit_id: string; topic_id: string }[]
  /** Direct exam question ↔ chapter links (`linked = false` = rejected). */
  questionLinks: { question_id: string; unit_id: string; linked: boolean }[]
  cards: CardReview[]
  logs: LectureLogRow[]
  /** Blocks from 14 days ago on. */
  blocks: PlanBlockRow[]
  sessions: SessionMinutes[]
  /** Personal block completion posterior (capacity per slot, slot scores, exploration). */
  completion: CompletionPosterior
  globalScale: { points_total: number; grade_scale: unknown } | undefined
  dayInput: (date: LocalDate) => DayInput
}

/** Longest planning horizon (days). */
export const HORIZON_DAYS = 180

export interface BuiltState {
  state: PlanState
  /** Today (local day at the boundary). */
  today: LocalDate
  /** Subjects whose target grade is out of reach or needs > 90% below "Važan". */
  targetGrade: string[]
  realization: ReturnType<typeof realization>
  /** Today's blocks stay as they are (replan starts tomorrow). */
  keepToday: boolean
  /** First day whose unstarted AI blocks the saved run replaces (`replace_plan` `p_from`). */
  replaceFrom: LocalDate
  /**
   * Today's free slots and manual blocks with a time (part of `input_hash`, and kept on the run):
   * when it differs from the last run's, today's AI blocks get new times.
   */
  todaySlotsKey: string
  /** Built with `replaceToday` (and today kept). */
  replacedToday: boolean
  /** Subjects behind their lectures, with the actions `paceActions()` suggests. */
  behind: SubjectBehindInput[]
}

/** A contingent exam enters the plan once it is needed (PRD "samo ako zatreba"). */
export function isActiveExam(
  exam: Assessment,
  subject: SubjectWithAssessments,
  deadlines: Deadline[],
) {
  if (exam.passed) return false
  if (!exam.contingent) return true
  const items = gradeItemsOf(subject, deadlines)
  const item = items.find((i) => i.id === exam.id)!
  if (exam.retake_of) return retakeStatus(item, items) === 'needed'
  // An integral exam is needed once a regular exam of the subject has a result and is not passed.
  return subject.assessments.some(
    (a) =>
      !a.contingent &&
      !a.passed &&
      (a.result_points !== null || a.result_annulled) &&
      a.id !== exam.id,
  )
}

/** Local date of an exam (its earliest day) in the user's zone. */
export function examDate(exam: Assessment, boundary: DayBoundary): LocalDate {
  return localDay(new Date(exam.at), { ...boundary, dayStartMin: 0 })
}

/**
 * Rough sources (decision Stage 8b): without manual scope rows, their parts are split in order
 * over the subject's partial exams that are not contingent (two partials: first half I, second
 * half II); `scope_all` exams cover everything anyway.
 */
export function roughScopeRows(
  units: { id: string }[],
  partials: { id: string }[],
  rows: ScopeRow[],
): ScopeRow[] {
  if (partials.length === 0) return []
  const own = new Set(rows.map((r) => r.unitId))
  const out: ScopeRow[] = []
  units.forEach((u, i) => {
    if (own.has(u.id)) return
    const exam =
      partials[Math.min(partials.length - 1, Math.floor((i * partials.length) / units.length))]!
    out.push({ assessmentId: exam.id, unitId: u.id, included: true })
  })
  return out
}

/** Required average share on the remaining exams for the target grade; null without one. */
export function requiredShareOf(
  subject: SubjectWithAssessments,
  deadlines: Deadline[],
  globalScale: PlanInputs['globalScale'],
): { share: number | null; unreachable: boolean } {
  if (subject.target_grade === null) return { share: null, unreachable: false }
  const projection = project(gradeItemsOf(subject, deadlines), gradeSubjectOf(subject, globalScale))
  if (projection.slots.length === 0) return { share: null, unreachable: false }
  const status = projection.grades.find((g) => g.grade === subject.target_grade)
  if (!status || status.kind === 'secured') return { share: 0, unreachable: false }
  if (status.kind === 'unreachable') return { share: 1, unreachable: true }
  return { share: status.pct, unreachable: false }
}

function presetsOf(profile: Profile): CustomPresetRow[] {
  return parseCustomPresets(profile.session_presets) as CustomPresetRow[]
}

/** The day a carried block ("Preskoči") was skipped on, from its `reason`. */
function carriedFrom(b: Pick<PlanBlockRow, 'reason'>): string | null {
  if (!b.reason || !b.reason.includes('"carried"')) return null
  try {
    const r = JSON.parse(b.reason) as { carried?: boolean; from?: string }
    return r.carried && typeof r.from === 'string' ? r.from : null
  } catch {
    return null
  }
}

/** History for ρ and the growth limit: planned AI minutes and studied minutes per day. */
export function historyOf(
  blocks: PlanBlockRow[],
  sessions: SessionMinutes[],
  boundary: DayBoundary,
  today: LocalDate,
): DayHistory[] {
  const days = new Map<LocalDate, DayHistory>()
  const get = (date: LocalDate) => {
    let d = days.get(date)
    if (!d) {
      d = { date, plannedMin: 0, doneAiMin: 0, studiedMin: 0, skipped: false }
      days.set(date, d)
    }
    return d
  }
  const ai = new Map(blocks.filter((b) => b.origin === 'ai').map((b) => [b.id, b]))
  for (const b of ai.values()) {
    if (b.on_date >= today) continue
    const d = get(b.on_date)
    if (b.status === 'skipped') d.skipped = true
    else d.plannedMin += b.planned_minutes
  }
  for (const s of sessions) {
    const date = localDay(new Date(s.startedAt), boundary)
    if (date >= today) continue
    const d = get(date)
    d.studiedMin += s.minutes
    const block = s.blockId ? ai.get(s.blockId) : undefined
    if (block && block.status !== 'skipped') get(block.on_date).doneAiMin += s.minutes
  }
  return [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
}

export interface BuildOptions {
  now: Date
  boundary: DayBoundary
  /**
   * Today's free time changed since the last run (decision, Stage 10b): today joins the planned
   * days with its not-started AI blocks fixed (same content, cap 0 so nothing is added), and
   * `placeTimes()` gives them new times from now (`fixedTimes`).
   */
  replaceToday?: boolean
}

export function buildPlanState(
  input: PlanInputs,
  { now, boundary, replaceToday = false }: BuildOptions,
): BuiltState {
  const { profile } = input
  const today = localDay(now, boundary)
  const subjects = input.subjects.filter((s) => !s.archived)
  const subjectIds = new Set(subjects.map((s) => s.id))

  // Units: leaves of active sources with estimates (speed factor included).
  const allSources = input.sources.filter((s) => subjectIds.has(s.subject_id))
  const sourceOrder = new Map(
    [...allSources]
      .sort(
        (a, b) =>
          a.subject_id.localeCompare(b.subject_id) || a.created_at.localeCompare(b.created_at),
      )
      .map((s, i) => [s.id, i]),
  )
  // A unit is due when it or one of its cards is due.
  const cardDue = new Map<string, LocalDate>()
  for (const c of input.cards) {
    if (c.next_review_on === null) continue
    const prev = cardDue.get(c.unit_id)
    if (!prev || c.next_review_on < prev) cardDue.set(c.unit_id, c.next_review_on)
  }
  const earliest = (a: LocalDate | null, b: LocalDate | undefined) =>
    b === undefined ? a : a === null || b < a ? b : a

  const units: PlanUnit[] = []
  const paces = new Map<string, (SourcePace | null)[]>()
  const leafIdsBySource = new Map<string, string[]>()
  const allUnitsForScope: { id: string; parentId: string | null }[] = []
  for (const source of allSources) {
    const material = materialOf(source, rateOf(source, allSources).mean)
    const leaves = leavesOf(asProgress(material.units))
    const leafIds = new Set(leaves.map((l) => l.id))
    const logs = input.logs.filter((l) => l.source_id === source.id)
    const paceLogs: PaceLog[] = logs.map((l) => ({
      id: l.id,
      onDate: l.on_date,
      createdAt: l.created_at,
      sourceId: l.source_id,
      upToUnitId: l.up_to_unit_id,
      cancelled: l.cancelled,
    }))
    const reached = reachedLogs(paceLogs)
    const paceUnits: PaceUnit[] = material.units.map((u) => ({
      id: u.id,
      parentId: u.parent_id,
      position: u.position,
      level: u.level,
      minutes: u.minutes,
    }))
    const coveredOn = new Map<string, LocalDate>()
    for (const log of reached)
      for (const leaf of coveredLeaves(paceUnits, log.upToUnitId!))
        if (!coveredOn.has(leaf.id)) coveredOn.set(leaf.id, log.onDate)
    const tracked = reached.length > 0
    if (tracked)
      paces.set(source.subject_id, [
        ...(paces.get(source.subject_id) ?? []),
        sourcePace(
          paceUnits.map((u) => ({
            ...u,
            amount: Number(material.units.find((m) => m.id === u.id)!.amount),
          })),
          paceLogs,
        ),
      ])
    for (const u of material.units) allUnitsForScope.push({ id: u.id, parentId: u.parent_id })
    leafIdsBySource.set(
      source.id,
      material.units.filter((u) => leafIds.has(u.id)).map((u) => u.id),
    )
    for (const u of material.units) {
      if (!leafIds.has(u.id)) continue
      units.push({
        id: u.id,
        subjectId: source.subject_id,
        sourceId: source.id,
        order: (sourceOrder.get(source.id) ?? 0) * 100000 + u.position,
        kind: u.kind === 'question' ? 'question' : 'chapter',
        level: u.level,
        minutes: Math.round(u.minutes * 10) / 10,
        difficulty: Math.round(u.difficulty * 100) / 100,
        confidence: u.confidence,
        questionCount: 0,
        pageStart: u.page_start,
        pageEnd: u.page_end,
        nextReviewOn: earliest(u.next_review_on, cardDue.get(u.id)),
        memory: memoryRef(memoryOf(u, boundary)),
        coveredOn: coveredOn.get(u.id) ?? null,
        tracked,
        ...readShareOf(u),
      })
    }
  }
  // Exam questions linked to a chapter through topics or directly.
  const linked = questionsByChapter(units, input.unitTopics, input.questionLinks)
  for (const u of units) if (u.kind === 'chapter') u.questionCount = linked.get(u.id)?.size ?? 0

  // Goals.
  const goals: PlanGoal[] = []
  const targetGrade: string[] = []
  const planSubjects: PlanSubject[] = []
  const rows = toScopeRows(input.scope)
  const subjectOfUnit = new Map(units.map((u) => [u.id, u.subjectId]))
  let lastGoal = today
  for (const subject of subjects) {
    const exams = subject.assessments
      .filter((a) => isActiveExam(a, subject, input.deadlines))
      .map((a) => ({ a, on: examDate(a, boundary) }))
      .filter((x) => x.on > today)
      .sort((x, y) => (x.on < y.on ? -1 : x.on > y.on ? 1 : x.a.id.localeCompare(y.a.id)))
    const partials = exams
      .filter((x) => x.a.kind === 'partial' && !x.a.scope_all && !x.a.contingent)
      .map((x) => x.a)
    const subjectSources = allSources.filter((s) => s.subject_id === subject.id)
    const extraRows = subjectSources
      .filter((s) => s.is_rough)
      .flatMap((s) =>
        roughScopeRows(
          (leafIdsBySource.get(s.id) ?? []).map((id) => ({ id })),
          partials,
          rows.filter((r) => subject.assessments.some((a) => a.id === r.assessmentId)),
        ),
      )
    for (const { a, on } of exams) {
      const scope = scopeOf({ id: a.id, scopeAll: a.scope_all }, allUnitsForScope, [
        ...rows,
        ...extraRows,
      ])
      goals.push({
        id: a.id,
        subjectId: subject.id,
        kind: 'exam',
        on,
        unitIds: [...scope].filter((id) => subjectOfUnit.get(id) === subject.id).sort(),
        minutes: 0,
        ...(a.points_max ? { points: a.points_max } : {}),
        // Only set when reserved, so plans without a reservation keep their input hash.
        ...(a.eve_reserved
          ? { eveReserved: true, atMin: wallClock(new Date(a.at), boundary.timeZone).minutes }
          : {}),
      })
      if (on > lastGoal) lastGoal = on
    }
    for (const d of input.deadlines) {
      if (d.subject_id !== subject.id || d.done || d.est_minutes === null) continue
      const on = localDay(new Date(d.due_at), boundary)
      if (on <= today) continue
      goals.push({
        id: d.id,
        subjectId: subject.id,
        kind: 'deadline',
        on,
        unitIds: [],
        minutes: Math.max(0, d.est_minutes - d.done_minutes),
      })
      if (on > lastGoal) lastGoal = on
    }
    const grade = requiredShareOf(subject, input.deadlines, input.globalScale)
    if (grade.unreachable || (grade.share !== null && grade.share > 0.9))
      targetGrade.push(subject.id)
    planSubjects.push({
      id: subject.id,
      priority: subject.priority,
      mode: subject.study_mode === 'campaign' ? 'campaign' : 'regular',
      campaignStartOn: subject.campaign_start_on,
      boostUntil: subject.priority_boost_until,
      requiredShare: grade.share === null ? null : Math.round(grade.share * 1000) / 1000,
    })
  }

  // Today stays as it is once it has AI blocks, unless it became impossible.
  const todayAi = input.blocks.filter((b) => b.on_date === today && b.origin === 'ai')
  const nowMin = Math.ceil(minutesOf(now, boundary) / 5) * 5
  const open = todayAi.filter((b) => b.status === 'planned')
  const freeLeft = freeSlotsOn(today, input.dayInput(today)).reduce(
    (s, x) => s + Math.max(0, x.endMin - Math.max(x.startMin, nowMin)),
    0,
  )
  const impossible = open.length > 0 && open.reduce((s, b) => s + b.planned_minutes, 0) > freeLeft
  // A block skipped away from today ("Preskoči") still keeps today's list: skipping is "not now",
  // not "plan me something else today".
  const skippedToday = input.blocks.some((b) => carriedFrom(b) === today)
  const keepToday = (todayAi.length > 0 || skippedToday) && !impossible
  const replacedToday = keepToday && replaceToday
  const replaceFrom = keepToday ? addDays(today, 1) : today
  const from = replacedToday ? today : replaceFrom
  const todaySlotsKey = JSON.stringify({
    on: today,
    slots: freeSlotsOn(today, input.dayInput(today)).map((x) => [x.startMin, x.endMin]),
    manual: input.blocks
      .filter((b) => b.on_date === today && b.origin === 'user' && b.start_min !== null)
      .filter((b) => b.status === 'planned' || b.status === 'in_progress')
      .map((b) => [b.start_min, b.planned_minutes])
      .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!),
  })

  const fixed: FixedBlock[] = input.blocks
    .filter((b) => b.on_date >= today && (b.status === 'planned' || b.status === 'in_progress'))
    .filter((b) => b.origin === 'user' || (keepToday && b.on_date === today))
    .map((b) => ({
      id: b.id,
      subjectId: b.subject_id,
      goalId: b.assessment_id ?? b.deadline_id,
      onDate: b.on_date,
      // An AI block keeps its time only once started (never moved under a running session).
      startMin: b.origin === 'user' || b.status === 'in_progress' ? b.start_min : null,
      minutes: b.planned_minutes,
      kind: b.kind,
      origin: b.origin,
      units: b.plan_block_units
        .map((u) => ({ unitId: u.unit_id, minutes: u.planned_minutes }))
        .sort((x, y) => x.unitId.localeCompare(y.unitId)),
    }))
    .sort((x, y) => (x.onDate < y.onDate ? -1 : x.onDate > y.onDate ? 1 : x.id.localeCompare(y.id)))

  const end = [lastGoal, addDays(today, HORIZON_DAYS)].sort()[0]!
  const days: PlanDay[] = []
  for (let d = from; d <= end; d = addDays(d, 1)) {
    const dayInput = input.dayInput(d)
    days.push({
      date: d,
      slots: freeSlotsOn(d, dayInput),
      // Re-placing today only moves its blocks; it never adds work (that is the "Imaš X min više
      // danas" card).
      cap: replacedToday && d === today ? 0 : capFor(d, dayInput),
      lectureSubjectIds: [
        ...new Set(
          classesOn(d, dayInput.entries, dayInput.periods)
            .filter(
              (c) => c.kind === 'lecture' && c.subjectId && !dayInput.cancelledEntryIds?.has(c.id),
            )
            .map((c) => c.subjectId!),
        ),
      ].sort(),
    })
  }

  const history = historyOf(input.blocks, input.sessions, boundary, today)
  const rho = realization(history, today)
  const parts = (profile.preferred_slots ?? []).filter((p): p is SlotPart =>
    (SLOT_PARTS as readonly string[]).includes(p),
  )

  const state: PlanState = {
    from,
    nowMin: from === today ? nowMin : null,
    days,
    subjects: planSubjects.sort((a, b) => a.id.localeCompare(b.id)),
    goals: goals.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : a.id.localeCompare(b.id))),
    units: units.sort((a, b) => a.id.localeCompare(b.id)),
    fixed,
    settings: {
      bufferDays: profile.buffer_days,
      maxSubjectsPerDay: profile.max_subjects_per_day,
      minBlockMinutes: profile.min_block_minutes,
      recapAfterLecture: profile.recap_after_lecture,
      reviewCapPct: profile.review_cap_pct,
      examEveEndMin: profile.exam_eve_end_min,
      lecturePaceDays: profile.lecture_pace_days,
    },
    preset: resolvePreset(profile.default_preset, presetsOf(profile)),
    rho: rho.rho,
    growthBase: growthBase(history, today, rho.rho),
    preferredParts: [...parts].sort(),
    slotCompletion: slotCompletion(input.completion),
    slotScores: slotScores(input.completion),
    // Seeded by the user and the week: the exploring day stays put across replans.
    explore: exploreDays(input.completion, from, end, profile.id),
    fsrsParams: paramsOf(profile.fsrs_params),
  }
  const behind: SubjectBehindInput[] = []
  for (const subject of subjects) {
    const list = paces.get(subject.id)
    if (!list) continue
    const b = subjectBehind(list)
    const actions = paceActions(b, {
      priority: subject.priority,
      studyMode: subject.study_mode === 'campaign' ? 'campaign' : 'regular',
    })
    if (actions.length > 0)
      behind.push({ subjectId: subject.id, behindMinutes: Math.round(b.behindMinutes), actions })
  }
  return {
    state,
    today,
    targetGrade,
    realization: rho,
    keepToday,
    replaceFrom,
    todaySlotsKey,
    replacedToday,
    behind,
  }
}

/** Only what the plan uses (strength on a day), so other memory fields do not change the hash. */
function memoryRef(m: ReturnType<typeof memoryOf>): PlanUnit['memory'] {
  return m
    ? {
        stability: Math.round(m.stability * 1000) / 1000,
        difficulty: Math.round(m.difficulty * 1000) / 1000,
        lastReviewOn: m.lastReviewOn,
      }
    : null
}

/** Wall-clock minutes on today's date; before the day boundary that is past midnight (+24 h). */
function minutesOf(now: Date, boundary: DayBoundary): number {
  const m = wallClock(now, boundary.timeZone).minutes
  return m < boundary.dayStartMin ? m + 24 * 60 : m
}

/**
 * Minutes of free time from `nowMin` that today gained between two slot keys (`todaySlotsKey`);
 * 0 for another day, an unreadable key or less time.
 */
export function gainedToday(previous: string, current: string, nowMin: number): number {
  const read = (key: string) => {
    try {
      return JSON.parse(key) as { on: string; slots: [number, number][] }
    } catch {
      return null
    }
  }
  const a = read(previous)
  const b = read(current)
  if (!a || !b || a.on !== b.on) return 0
  const free = (slots: [number, number][]) =>
    slots.reduce((sum, [start, end]) => sum + Math.max(0, end - Math.max(start, nowMin)), 0)
  return Math.max(0, free(b.slots) - free(a.slots))
}

/** Partial reading (Stage 10b) as a rounded share; nothing when unread, so the hash stays put. */
function readShareOf(u: { level: number; amount: number; read_amount: number | null }) {
  const read = Number(u.read_amount ?? 0)
  if (u.level !== 0 || read <= 0 || u.amount <= 0 || read >= u.amount) return {}
  return { readShare: Math.round(Math.min(1, read / u.amount) * 1000) / 1000 }
}

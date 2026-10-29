import { addDays, diffDays, type LocalDate } from '@/lib/day'
import { partOf, type SlotPart } from '@/lib/schedule/rhythm'
import {
  growthBase,
  LATE_AFTER_MIN,
  plan,
  realization,
  workShare,
  type DayHistory,
  type PlanState,
  type PlanUnit,
  type PlannedBlock,
} from '@/lib/scheduler'
import { BUILT_IN_PRESETS } from '@/lib/session/timer'
import {
  levelAfter,
  READ_CHECK_DAYS,
  retrievabilityOn,
  review,
  targetRetention,
  type Memory,
  type Recall,
} from '@/lib/srs'
import { rng, type Rng } from './random'
import {
  DEFAULT_STUDENT,
  simulateBlock,
  type BlockContext,
  type BlockOutcome,
  type StudentParams,
} from './student'
import { isWeekend, makeWorld, type World } from './world'

/** One simulated block as the app would log it: plan-time features and the label it sees. */
export interface BlockExample {
  run: number
  subjectId: string
  /** Ground truth, not visible to the app: the student avoids this subject. */
  avoided: boolean
  kind: PlannedBlock['kind']
  onDate: LocalDate
  startMin: number
  part: SlotPart
  weekend: boolean
  plannedMinutes: number
  dayLoadMin: number
  daysToGoal: number | null
  demand: number
  prevLate: boolean
  label: 'done' | 'skipped' | 'unconfirmed'
  done: boolean
  delayMin: number
}

export interface RunMetrics {
  /** Σ points × mean R of the exam's units on exam day / Σ points (0–1). */
  examScore: number
  /** Work left (estimated minutes) on exam days. */
  deficitMin: number
  /** Share of planned blocks not done. */
  missedShare: number
  /** Mean share of today's planned minutes that moved between subjects since yesterday's plan. */
  planChurn: number
  /** Standard deviation of planned minutes per study day. */
  loadSd: number
  /** Done share of blocks on avoided and on neutral subjects. */
  completionAvoided: number
  completionNeutral: number
  /** Done share per subject id (subjects that got blocks). */
  completionBySubject: Record<string, number>
}

export interface RunResult {
  metrics: RunMetrics
  examples: BlockExample[]
}

const SETTINGS: PlanState['settings'] = {
  bufferDays: 1,
  maxSubjectsPerDay: 3,
  minBlockMinutes: 25,
  recapAfterLecture: false,
  reviewCapPct: 40,
  examEveEndMin: 23 * 60,
  lecturePaceDays: 7,
}

interface UnitState {
  unit: PlanUnit
  memory: Memory | null
  /** Progress of the level-1 pass (understanding), 0–1. */
  pass: number
}

function drawRecall(memory: Memory | null, on: LocalDate, r: Rng): Recall {
  // The app's FSRS memory doubles as the student's true memory; a read check has no memory yet.
  const p = memory ? retrievabilityOn(memory, on) : 0.55
  if (r.chance(p)) return 2
  return r.chance(0.5) ? 1 : 0
}

/** One run: plan every morning with the real `plan()`, then live the day as the student. */
export function simulate(
  seed: number,
  params: StudentParams = DEFAULT_STUDENT,
  worldOf: (r: Rng) => World = makeWorld,
): RunResult {
  const r = rng(seed)
  const world = worldOf(r)
  const speed = new Map(
    world.subjects.map((s) => [s.id, r.logNormal(0, params.subjectSpeedSigma)] as const),
  )
  const index = new Map(world.subjects.map((s, i) => [s.id, i] as const))
  const units = new Map<string, UnitState>(
    world.units.map((u) => [u.id, { unit: { ...u }, memory: null, pass: 0 }]),
  )
  const goalOf = new Map(world.goals.flatMap((g) => g.unitIds.map((id) => [id, g] as const)))
  const priority = new Map(world.subjects.map((s) => [s.id, s.priority] as const))
  const lastExam = world.goals.reduce((m, g) => (g.on > m ? g.on : m), world.start)

  const history: DayHistory[] = []
  const examples: BlockExample[] = []
  const churn: number[] = []
  const dayLoads: number[] = []
  let scoreSum = 0
  let pointsSum = 0
  let deficitMin = 0
  let previous: Map<string, number> | null = null

  for (let day = world.start; day <= lastExam; day = addDays(day, 1)) {
    // Exams of the day: strength of every unit and the work left.
    for (const g of world.goals.filter((x) => x.on === day)) {
      let strength = 0
      for (const id of g.unitIds) {
        const u = units.get(id)!
        strength += u.memory ? retrievabilityOn(u.memory, day) : u.unit.level >= 1 ? 0.3 : 0
        deficitMin +=
          u.unit.minutes * workShare(u.unit.kind, u.unit.level) * (1 - (u.unit.readShare ?? 0))
      }
      scoreSum += world.points[g.id]! * (strength / g.unitIds.length)
      pointsSum += world.points[g.id]!
    }
    const goals = world.goals.filter((g) => g.on > day)
    if (goals.length === 0) break
    const open = new Set(goals.map((g) => g.subjectId))
    const cantToday = r.chance(params.cantTodayP)

    const rho = realization(history, day).rho
    const horizon = diffDays(
      day,
      goals.reduce((m, g) => (g.on > m ? g.on : m), day),
    )
    const state: PlanState = {
      from: day,
      nowMin: null,
      days: Array.from({ length: horizon + 1 }, (_, i) => {
        const date = addDays(day, i)
        return { date, slots: world.slots(date), cap: world.cap(date), lectureSubjectIds: [] }
      }),
      subjects: world.subjects.filter((s) => open.has(s.id)),
      goals,
      units: [...units.values()]
        .filter((u) => open.has(u.unit.subjectId))
        .map((u) => ({
          ...u.unit,
          memory: u.memory && {
            stability: u.memory.stability,
            lastReviewOn: u.memory.lastReviewOn,
          },
        })),
      fixed: [],
      settings: SETTINGS,
      preset: BUILT_IN_PRESETS[0]!,
      rho,
      growthBase: growthBase(history, day, rho),
      preferredParts: [],
    }
    const result = plan(state)
    const today = result.blocks
      .filter((b) => b.onDate === day && b.startMin !== null)
      .sort((a, b) => a.startMin! - b.startMin!)

    // Plan change: today's minutes per subject against what yesterday's plan had for today.
    const bySubject = new Map<string, number>()
    for (const b of today) bySubject.set(b.subjectId, (bySubject.get(b.subjectId) ?? 0) + b.minutes)
    const plannedToday = today.reduce((s, b) => s + b.minutes, 0)
    if (previous && plannedToday > 0) {
      const ids = new Set([...previous.keys(), ...bySubject.keys()])
      let moved = 0
      for (const id of ids) moved += Math.abs((bySubject.get(id) ?? 0) - (previous.get(id) ?? 0))
      churn.push(moved / 2 / plannedToday)
    }
    const tomorrow = new Map<string, number>()
    for (const b of result.blocks.filter((x) => x.onDate === addDays(day, 1)))
      tomorrow.set(b.subjectId, (tomorrow.get(b.subjectId) ?? 0) + b.minutes)
    previous = tomorrow
    if (plannedToday > 0) dayLoads.push(plannedToday)

    let prevLate = false
    let doneMin = 0
    for (const b of today) {
      const goal = b.goalId ? world.goals.find((g) => g.id === b.goalId) : undefined
      const context: BlockContext = {
        subjectIndex: index.get(b.subjectId)!,
        part: partOf(b.startMin!),
        weekend: isWeekend(day),
        kind: b.kind,
        demand: b.demand,
        dayLoadMin: plannedToday,
        daysToGoal: goal ? diffDays(day, goal.on) : null,
        prevLate,
      }
      const outcome: BlockOutcome = cantToday
        ? { done: false, label: 'skipped' as const, delayMin: 0, realFactor: 1 }
        : simulateBlock(params, context, r)
      examples.push({
        run: seed,
        subjectId: b.subjectId,
        avoided: params.avoided.includes(context.subjectIndex),
        kind: b.kind,
        onDate: day,
        startMin: b.startMin!,
        part: context.part,
        weekend: context.weekend,
        plannedMinutes: b.minutes,
        dayLoadMin: plannedToday,
        daysToGoal: context.daysToGoal,
        demand: Math.round(b.demand * 1000) / 1000,
        prevLate,
        label: outcome.label,
        done: outcome.done,
        delayMin: Math.round(outcome.delayMin),
      })
      prevLate = outcome.done && outcome.delayMin > LATE_AFTER_MIN
      if (!outcome.done) continue
      doneMin += b.minutes
      const factor = outcome.realFactor * speed.get(b.subjectId)!
      for (const bu of b.units) {
        const u = units.get(bu.unitId)
        if (!u) continue
        const g = goalOf.get(bu.unitId)!
        const retention = targetRetention(priority.get(u.unit.subjectId)!, 'chapter')
        const lastDay = addDays(g.on, -1)
        const test = () => {
          const recall = drawRecall(u.memory, day, r)
          const next = review({ memory: u.memory, recall, today: day, retention, lastDay })
          u.memory = next.memory
          u.unit.level = levelAfter('chapter', u.unit.level, recall, next.memory.streak)
          u.unit.nextReviewOn = recall === 0 && u.unit.level <= 1 ? null : next.nextReviewOn
        }
        if (b.kind === 'review') {
          if (u.unit.nextReviewOn !== null && u.unit.nextReviewOn <= day) test()
          continue
        }
        const work = bu.minutes / factor
        if (u.unit.level === 0) {
          const share = (u.unit.readShare ?? 0) + work / u.unit.minutes
          if (share >= 1) {
            u.unit.level = 1
            u.unit.readShare = undefined
            u.unit.nextReviewOn = addDays(day, READ_CHECK_DAYS)
          } else u.unit.readShare = share
        } else if (u.unit.level === 1) {
          u.pass += work / (u.unit.minutes * workShare('chapter', 1))
          if (u.pass >= 1) {
            u.pass = 0
            test()
          }
        }
      }
    }
    history.push({
      date: day,
      plannedMin: plannedToday,
      doneAiMin: doneMin,
      studiedMin: doneMin,
      skipped: cantToday,
    })
  }

  const doneShare = (list: BlockExample[]) =>
    list.length === 0 ? 0 : list.filter((e) => e.done).length / list.length
  const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length)
  const loadMean = mean(dayLoads)
  const completionBySubject: Record<string, number> = {}
  for (const s of world.subjects) {
    const own = examples.filter((e) => e.subjectId === s.id)
    if (own.length > 0) completionBySubject[s.id] = doneShare(own)
  }
  return {
    metrics: {
      examScore: pointsSum > 0 ? scoreSum / pointsSum : 0,
      deficitMin,
      missedShare: 1 - doneShare(examples),
      planChurn: mean(churn),
      loadSd: Math.sqrt(mean(dayLoads.map((x) => (x - loadMean) ** 2))),
      completionAvoided: doneShare(examples.filter((e) => e.avoided)),
      completionNeutral: doneShare(examples.filter((e) => !e.avoided)),
      completionBySubject,
    },
    examples,
  }
}

export type Summary = Omit<RunMetrics, 'completionBySubject'>

/** Mean of every metric over the seeds (per-subject completion stays in the runs). */
export function summarize(runs: RunMetrics[]): Summary {
  const keys = [
    'examScore',
    'deficitMin',
    'missedShare',
    'planChurn',
    'loadSd',
    'completionAvoided',
    'completionNeutral',
  ] as const
  const out = {} as Summary
  for (const k of keys)
    out[k] = Math.round((runs.reduce((s, m) => s + m[k], 0) / runs.length) * 1000) / 1000
  return out
}

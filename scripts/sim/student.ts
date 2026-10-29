import type { BlockKind } from '@/lib/scheduler'
import type { SlotPart } from '@/lib/schedule/rhythm'
import { sigmoid, type Rng } from './random'

/**
 * The simulated student (RESEARCH-ML 3, ROADMAP 11a "Simulator"). Parameters come from the
 * literature, to be fitted to real logs later; every one is part of the seed config, so a run is
 * reproducible. Block completion is a logistic model on the same features the app's model will
 * see, plus a per-subject avoidance the app does not know (it has to find it).
 */
export interface StudentParams {
  /** Logit of completing a block in a neutral slot. */
  base: number
  part: Record<SlotPart, number>
  weekend: number
  /** Per hour of planned work that day above `loadFreeMin`. */
  loadPerHour: number
  loadFreeMin: number
  kind: Partial<Record<BlockKind, number>>
  /** Per unit of placement demand above 1 (first pass, harder material). */
  demand: number
  /** When the goal is at most `nearGoalDays` away. */
  nearGoal: number
  nearGoalDays: number
  /** The previous block that day started late. */
  prevLate: number
  /** Subjects the student avoids (indices into the world's subjects) and how strongly. */
  avoided: number[]
  avoidLogit: number
  /** Extra start delay on an avoided subject (minutes, median). */
  avoidDelayMin: number
  /** Start delay ~ log-normal (median minutes, sigma). */
  delayMedianMin: number
  delaySigma: number
  /** Planning fallacy: real minutes / estimate ~ log-normal(ln(fallacy), sigma). */
  fallacy: number
  durationSigma: number
  /** Per-subject speed spread (log sd) around the estimates. */
  subjectSpeedSigma: number
  /** "Danas ne mogu" days. */
  cantTodayP: number
  /** A block not done is marked "Preskoči" with this probability; otherwise it stays unmarked. */
  markSkipP: number
  /** A block done without starting the timer or marking it (unconfirmed though done). */
  unmarkedDoneP: number
}

export const DEFAULT_STUDENT: StudentParams = {
  base: 1.6,
  part: { morning: 0.2, midday: 0, afternoon: 0, evening: -0.3, night: -1 },
  weekend: -0.4,
  loadPerHour: -0.35,
  loadFreeMin: 120,
  kind: { review: 0.3, recap: 0.2 },
  demand: -0.3,
  nearGoal: 0.6,
  nearGoalDays: 3,
  prevLate: -0.4,
  avoided: [0],
  avoidLogit: -1.2,
  avoidDelayMin: 20,
  delayMedianMin: 3,
  delaySigma: 0.9,
  fallacy: 1.15,
  durationSigma: 0.3,
  subjectSpeedSigma: 0.15,
  cantTodayP: 0.04,
  markSkipP: 0.35,
  unmarkedDoneP: 0.08,
}

export interface BlockContext {
  subjectIndex: number
  part: SlotPart
  weekend: boolean
  kind: BlockKind
  demand: number
  dayLoadMin: number
  daysToGoal: number | null
  prevLate: boolean
}

export function completionLogit(p: StudentParams, b: BlockContext): number {
  const load = Math.max(0, b.dayLoadMin - p.loadFreeMin) / 60
  return (
    p.base +
    p.part[b.part] +
    (b.weekend ? p.weekend : 0) +
    p.loadPerHour * load +
    (p.kind[b.kind] ?? 0) +
    p.demand * Math.max(0, b.demand - 1) +
    (b.daysToGoal !== null && b.daysToGoal <= p.nearGoalDays ? p.nearGoal : 0) +
    (b.prevLate ? p.prevLate : 0) +
    (p.avoided.includes(b.subjectIndex) ? p.avoidLogit : 0)
  )
}

export interface BlockOutcome {
  done: boolean
  /** What the app sees: done (confirmed), skipped (explicit) or unconfirmed. */
  label: 'done' | 'skipped' | 'unconfirmed'
  delayMin: number
  /** Real minutes the planned work would take (only meaningful when done). */
  realFactor: number
}

export function simulateBlock(p: StudentParams, b: BlockContext, r: Rng): BlockOutcome {
  const avoided = p.avoided.includes(b.subjectIndex)
  const delayMin =
    r.logNormal(Math.log(p.delayMedianMin), p.delaySigma) + (avoided ? p.avoidDelayMin : 0)
  const done = r.chance(sigmoid(completionLogit(p, b)))
  const realFactor = r.logNormal(Math.log(p.fallacy), p.durationSigma)
  const label = done
    ? r.chance(p.unmarkedDoneP)
      ? 'unconfirmed'
      : 'done'
    : r.chance(p.markSkipP)
      ? 'skipped'
      : 'unconfirmed'
  return { done, label, delayMin, realFactor }
}

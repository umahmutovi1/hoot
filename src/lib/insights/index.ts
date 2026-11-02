import { addDays, diffDays, type LocalDate } from '@/lib/day'
import { SLOT_PARTS, type SlotPart } from '@/lib/schedule/rhythm'
import { rhythmSuggestion, type SessionRhythm } from '@/lib/session/rhythm'
import type { Preset } from '@/lib/session/timer'
import type { SubjectEffect } from '@/lib/slots/completion'
import { MIN_SLOT_SESSIONS, type SlotSignals } from '@/lib/slots/signals'

/**
 * Insights (PRD "Termini učenja" → Uvidi, Uvidi iz nauke o učenju; Sprint 17): rules in code turn
 * the user's own signals into a sentence with a number and at most one action; AI only words
 * them and they work without it. Each needs enough measurements, speaks about "kod tebe" (never a
 * cause, a diagnosis or other users) and carries a stable `id`, so "nije korisno" and accepted
 * actions can be recorded. Ordered by the expected effect on the nearest exam.
 */

export type StudyMode = 'reading' | 'problems' | 'review' | 'questions'

/** Rows of the PRD table "Tehnike" a tip comes from (the UI holds the copy and the source). */
export type Technique =
  'self_testing' | 'breaks' | 'implementation_intentions' | 'calibration_feedback' | 'sleep'

export type InsightAction =
  | { kind: 'add_slot'; weekend: boolean; part: SlotPart }
  | { kind: 'set_preset'; workMin: number; breakMin: number }
  | { kind: 'first_step'; subjectId: string }
  | { kind: 'strict_recall_gate'; subjectId: string }
  | { kind: 'questions_next'; blocks: number }
  | { kind: 'end_by'; goalId: string; untilMin: number; until: LocalDate }

export type Insight = {
  id: string
  technique: Technique | null
  action: InsightAction | null
} & (
  | { kind: 'late_before_exam'; goalId: string; subjectId: string; nights: number }
  | {
      kind: 'avoidance'
      subjectId: string
      postponed: number
      /** Average postponements of the other subjects in the same 14 days. */
      othersAverage: number
    }
  | { kind: 'recall_share'; share: number; minutes: number }
  | { kind: 'calibration'; subjectId: string; overBy: number; pairs: number }
  | { kind: 'best_slot'; weekend: boolean; part: SlotPart; focus: number; sessions: number }
  | { kind: 'first_break'; aboutMin: number; sessions: number }
  | {
      kind: 'distraction'
      weekend: boolean
      part: SlotPart
      leavesPer30: number
      sessions: number
    }
  | { kind: 'speed'; mode: StudyMode; ratio: number; sessions: number }
)

export interface InsightInput {
  today: LocalDate
  slots: SlotSignals | null
  rhythm: SessionRhythm | null
  preset: Preset
  /** Measured / expected speed per study mode (> 1 slower). */
  modeSpeeds: { mode: StudyMode; ratio: number; sessions: number }[]
  /** Subject intercepts of the completion model (`subjectEffects()`). */
  subjectEffects: SubjectEffect[]
  /** Skipped, unconfirmed or late-started AI blocks (one row each). */
  postponements: { subjectId: string; onDate: LocalDate }[]
  /** Self-assessment vs outcome, both 0–1 (level or readiness vs recall or points). */
  calibration: { subjectId: string; predicted: number; actual: number }[]
  /** Minutes studied this week by mode. */
  weekModes: { mode: StudyMode | null; minutes: number }[]
  /** Local day a session ended on and its end in minutes after that day's midnight (≥ 1440 past midnight). */
  sessionEnds: { onDate: LocalDate; endMin: number }[]
  /** Upcoming exams. */
  exams: { goalId: string; subjectId: string; on: LocalDate }[]
}

export const AVOID_DAYS = 14
export const AVOID_MIN = 3
export const AVOID_RATIO = 2
/** One-sided 95%: the subject effect is clearly below the others (PRD decision). */
export const AVOID_Z = -1.645
export const CALIBRATION_MIN_PAIRS = 10
export const CALIBRATION_OVER = 0.15
export const RECALL_MIN_WEEK = 180
export const RECALL_SHARE_MIN = 0.3
export const LATE_END_MIN = 24 * 60 + 30
export const LATE_NIGHTS = 2
export const LATE_WINDOW_DAYS = 7
const BEST_FOCUS = 2.3
const ADD_FOCUS = 2.5
const DISTRACTED_PER30 = 2
const SPEED_GAP = 0.2

const RECALL_MODES: ReadonlySet<StudyMode> = new Set(['review', 'questions', 'problems'])
const round = (x: number, digits = 2) => Math.round(x * 10 ** digits) / 10 ** digits

function lateBeforeExam(input: InsightInput): Insight[] {
  const out: Insight[] = []
  for (const e of input.exams) {
    if (e.on < input.today || diffDays(input.today, e.on) > LATE_WINDOW_DAYS) continue
    const from = addDays(e.on, -LATE_WINDOW_DAYS)
    const nights = new Set(
      input.sessionEnds
        .filter((s) => s.onDate >= from && s.onDate < e.on && s.endMin >= LATE_END_MIN)
        .map((s) => s.onDate),
    ).size
    if (nights >= LATE_NIGHTS)
      out.push({
        id: `late_before_exam:${e.goalId}`,
        kind: 'late_before_exam',
        goalId: e.goalId,
        subjectId: e.subjectId,
        nights,
        technique: 'sleep',
        action: { kind: 'end_by', goalId: e.goalId, untilMin: 23 * 60, until: e.on },
      })
  }
  return out
}

function avoidance(input: InsightInput): Insight[] {
  const from = addDays(input.today, -AVOID_DAYS)
  const counts = new Map<string, number>()
  for (const p of input.postponements)
    if (p.onDate >= from && p.onDate < input.today)
      counts.set(p.subjectId, (counts.get(p.subjectId) ?? 0) + 1)
  const subjects = [...new Set([...counts.keys(), ...input.subjectEffects.map((e) => e.subjectId)])]
  if (subjects.length < 2) return []
  const effects = new Map(input.subjectEffects.map((e) => [e.subjectId, e]))
  const out: Insight[] = []
  for (const subjectId of subjects.sort()) {
    const postponed = counts.get(subjectId) ?? 0
    const others = subjects.filter((s) => s !== subjectId)
    const othersAverage = others.reduce((s, x) => s + (counts.get(x) ?? 0), 0) / others.length
    if (postponed < AVOID_MIN || postponed < AVOID_RATIO * othersAverage) continue
    // With enough blocks the model must agree, so a bad slot or a full day is not blamed on it.
    const e = effects.get(subjectId)
    if (e && e.weight >= AVOID_MIN && e.sd > 0 && e.mean / e.sd >= AVOID_Z) continue
    out.push({
      id: `avoidance:${subjectId}`,
      kind: 'avoidance',
      subjectId,
      postponed,
      othersAverage: round(othersAverage, 1),
      technique: 'implementation_intentions',
      action: { kind: 'first_step', subjectId },
    })
  }
  return out
}

function recallShare(input: InsightInput): Insight[] {
  const minutes = input.weekModes.reduce((s, m) => s + m.minutes, 0)
  if (minutes < RECALL_MIN_WEEK) return []
  const recall = input.weekModes
    .filter((m) => m.mode !== null && RECALL_MODES.has(m.mode))
    .reduce((s, m) => s + m.minutes, 0)
  const share = recall / minutes
  if (share >= RECALL_SHARE_MIN) return []
  return [
    {
      id: 'recall_share',
      kind: 'recall_share',
      share: round(share),
      minutes: Math.round(minutes),
      technique: 'self_testing',
      action: { kind: 'questions_next', blocks: 2 },
    },
  ]
}

function calibration(input: InsightInput): Insight[] {
  const by = new Map<string, { over: number; n: number }>()
  for (const p of input.calibration) {
    const acc = by.get(p.subjectId) ?? { over: 0, n: 0 }
    acc.over += p.predicted - p.actual
    acc.n++
    by.set(p.subjectId, acc)
  }
  const out: Insight[] = []
  for (const [subjectId, { over, n }] of [...by].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (n < CALIBRATION_MIN_PAIRS || over / n < CALIBRATION_OVER) continue
    out.push({
      id: `calibration:${subjectId}`,
      kind: 'calibration',
      subjectId,
      overBy: round(over / n),
      pairs: n,
      technique: 'calibration_feedback',
      action: { kind: 'strict_recall_gate', subjectId },
    })
  }
  return out
}

function slotInsights(input: InsightInput): Insight[] {
  if (!input.slots) return []
  const rows = (['weekday', 'weekend'] as const).flatMap((kind) =>
    SLOT_PARTS.map((part) => ({
      weekend: kind === 'weekend',
      part,
      sig: input.slots![kind][part],
    })),
  )
  const measured = rows.filter((r) => r.sig.sessions >= MIN_SLOT_SESSIONS)
  const out: Insight[] = []
  const best = measured
    .filter((r) => r.sig.focus !== null && r.sig.focus >= BEST_FOCUS)
    .sort((a, b) => b.sig.focus! - a.sig.focus! || b.sig.sessions - a.sig.sessions)[0]
  if (best)
    out.push({
      id: `best_slot:${best.weekend ? 'weekend' : 'weekday'}:${best.part}`,
      kind: 'best_slot',
      weekend: best.weekend,
      part: best.part,
      focus: best.sig.focus!,
      sessions: best.sig.sessions,
      technique: 'implementation_intentions',
      action:
        best.sig.focus! >= ADD_FOCUS && best.sig.z > 0
          ? { kind: 'add_slot', weekend: best.weekend, part: best.part }
          : null,
    })
  const distracted = measured
    .filter((r) => r.sig.leavesPer30 !== null && r.sig.leavesPer30 >= DISTRACTED_PER30)
    .sort((a, b) => b.sig.leavesPer30! - a.sig.leavesPer30!)[0]
  if (distracted)
    out.push({
      id: `distraction:${distracted.weekend ? 'weekend' : 'weekday'}:${distracted.part}`,
      kind: 'distraction',
      weekend: distracted.weekend,
      part: distracted.part,
      leavesPer30: distracted.sig.leavesPer30!,
      sessions: distracted.sig.sessions,
      technique: 'breaks',
      action: null,
    })
  return out
}

function firstBreak(input: InsightInput): Insight[] {
  if (!input.rhythm) return []
  const s = rhythmSuggestion(input.rhythm, input.preset)
  return [
    {
      id: 'first_break',
      kind: 'first_break',
      aboutMin: input.rhythm.firstBreakMin,
      sessions: input.rhythm.sessions,
      technique: 'breaks',
      action: s ? { kind: 'set_preset', workMin: s.workMin, breakMin: s.breakMin } : null,
    },
  ]
}

function speed(input: InsightInput): Insight[] {
  return input.modeSpeeds
    .filter((m) => m.sessions >= MIN_SLOT_SESSIONS && Math.abs(m.ratio - 1) >= SPEED_GAP)
    .sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1) || (a.mode < b.mode ? -1 : 1))
    .slice(0, 1)
    .map((m) => ({
      id: `speed:${m.mode}`,
      kind: 'speed' as const,
      mode: m.mode,
      ratio: round(m.ratio),
      sessions: m.sessions,
      technique: null,
      action: null,
    }))
}

/** Every insight that passes its threshold, by expected effect on the nearest exam. */
export function insights(input: InsightInput): Insight[] {
  return [
    ...lateBeforeExam(input),
    ...avoidance(input),
    ...recallShare(input),
    ...calibration(input),
    ...slotInsights(input),
    ...firstBreak(input),
    ...speed(input),
  ]
}

/** Without the ones marked "nije korisno". */
export function shownInsights(list: Insight[], dismissed: ReadonlySet<string>): Insight[] {
  return list.filter((i) => !dismissed.has(i.id))
}

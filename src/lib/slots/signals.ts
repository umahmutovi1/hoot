import {
  diffDays,
  localDay,
  wallClock,
  weekdayOf,
  type DayBoundary,
  type LocalDate,
} from '@/lib/day'
import type { SlotCompletion } from '@/lib/scheduler/types'
import { partOf, SLOT_PARTS, type SlotPart } from '@/lib/schedule/rhythm'

/**
 * Signals per slot (PRD "Termini učenja" → Signali po terminu, Sprint 17): focus, speed, start
 * delay and distractions from timer sessions, next to the completion model (`completion.ts`),
 * which already covers "odrađenost". Each signal is standardized against the user's own mean,
 * shrunk towards it by `k/(k+6)` (k = weighted measurements, the calibration pattern) and older
 * sessions weigh less (half-life 6 weeks, PRD "Zamke"). The combined score nudges the slot scores
 * of `placeTimes()`; it never changes capacity.
 */

export type DayKind = 'weekday' | 'weekend'

/** One timer session as the slot signals see it. */
export interface SlotObservation {
  onDate: LocalDate
  part: SlotPart
  weekend: boolean
  /** 1–3 from the end of the session; null when not given. */
  focus: number | null
  /** "Teško gradivo" was a reason for low focus: the focus counts half (PRD). */
  hard: boolean
  /** Measured / expected minutes for the material done, difficulty included (> 1 = slower). */
  speed: number | null
  /** Minutes from the block's planned start to the session start; null without a planned block. */
  startDelayMin: number | null
  /** Active minutes. */
  minutes: number
  /** App leaves and "Ometena sam" taps. */
  leaves: number
}

export const SIGNAL_HALF_LIFE_DAYS = 42
/** A start later than this after the planned one is a (partial) failure (PRD "Kašnjenje starta"). */
export const START_LATE_MIN = 30
/** Measurements at which a slot's own value and the prior weigh the same (`k/(k+6)`). */
export const SIGNAL_SHRINK_K = 6
/** Cards and the slot map speak about a slot from this many sessions on (PRD: ≥ 6). */
export const MIN_SLOT_SESSIONS = 6
/** Change of a slot score per standard deviation of the combined signal (one `SLOT_GAP`). */
export const SIGNAL_STEP = 0.05

const WEIGHTS = { focus: 0.4, speed: 0.2, delay: 0.2, leaves: 0.2 } as const
type Signal = keyof typeof WEIGHTS
const SIGNALS = Object.keys(WEIGHTS) as Signal[]

export interface SlotSignal {
  /** Sessions in the slot (unweighted), for "Uči se… još N sesija". */
  sessions: number
  /** Mean focus 1–3 (weighted), null without one. */
  focus: number | null
  /** Mean speed ratio, null without one. */
  speed: number | null
  /** Share of planned starts later than `START_LATE_MIN`, null without planned blocks. */
  lateShare: number | null
  /** Leaves per 30 active minutes, null without minutes. */
  leavesPer30: number | null
  /** Combined, standardized and shrunk: 0 = like the user's average slot, > 0 better. */
  z: number
}

export type SlotSignals = Record<DayKind, Record<SlotPart, SlotSignal>>

/** Higher is better for every signal, on comparable scales. */
function goodness(o: SlotObservation, signal: Signal): { value: number; weight: number } | null {
  switch (signal) {
    case 'focus':
      return o.focus === null ? null : { value: o.focus - 2, weight: o.hard ? 0.5 : 1 }
    case 'speed':
      return o.speed === null || o.speed <= 0
        ? null
        : { value: -Math.max(-1, Math.min(1, Math.log(o.speed))), weight: 1 }
    case 'delay':
      // Up to 30 min late counts in part, later is a (partial) failure.
      return o.startDelayMin === null
        ? null
        : {
            value:
              o.startDelayMin > START_LATE_MIN
                ? -1
                : -Math.max(0, o.startDelayMin) / START_LATE_MIN / 2,
            weight: 1,
          }
    case 'leaves':
      return o.minutes <= 0
        ? null
        : {
            value: -Math.min(3, (o.leaves * 30) / o.minutes) / 3,
            weight: Math.min(1, o.minutes / 30),
          }
  }
}

const round3 = (x: number) => Math.round(x * 1000) / 1000

interface Acc {
  sum: number
  w: number
}

export function slotSignals(observations: SlotObservation[], today: LocalDate): SlotSignals {
  const decay = (o: SlotObservation) =>
    Math.pow(0.5, Math.max(0, diffDays(o.onDate, today)) / SIGNAL_HALF_LIFE_DAYS)
  const key = (o: SlotObservation) => `${o.weekend ? 'weekend' : 'weekday'}|${o.part}`

  // The user's own mean and spread per signal (the "prior" each slot is shrunk to).
  const overall = new Map<Signal, { mean: number; sd: number }>()
  const bySlot = new Map<string, Map<Signal, Acc>>()
  for (const signal of SIGNALS) {
    let sum = 0
    let sq = 0
    let w = 0
    for (const o of observations) {
      const g = goodness(o, signal)
      if (!g) continue
      const weight = g.weight * decay(o)
      sum += weight * g.value
      sq += weight * g.value * g.value
      w += weight
      const slot = bySlot.get(key(o)) ?? new Map<Signal, Acc>()
      const acc = slot.get(signal) ?? { sum: 0, w: 0 }
      acc.sum += weight * g.value
      acc.w += weight
      slot.set(signal, acc)
      bySlot.set(key(o), slot)
    }
    if (w === 0) continue
    const mean = sum / w
    // A floor on the spread, so a user whose sessions are all alike gets no large z from noise.
    overall.set(signal, { mean, sd: Math.max(0.25, Math.sqrt(Math.max(0, sq / w - mean * mean))) })
  }

  const table = (kind: DayKind) =>
    Object.fromEntries(
      SLOT_PARTS.map((part) => {
        const own = observations.filter((o) => key(o) === `${kind}|${part}`)
        const accs = bySlot.get(`${kind}|${part}`)
        let z = 0
        for (const signal of SIGNALS) {
          const acc = accs?.get(signal)
          const all = overall.get(signal)
          if (!acc || !all || acc.w === 0) continue
          const shrink = acc.w / (acc.w + SIGNAL_SHRINK_K)
          z += WEIGHTS[signal] * (((acc.sum / acc.w - all.mean) / all.sd) * shrink)
        }
        const mean = (pick: (o: SlotObservation) => number | null, weight = decay) => {
          let s = 0
          let w = 0
          for (const o of own) {
            const v = pick(o)
            if (v === null) continue
            s += weight(o) * v
            w += weight(o)
          }
          return w === 0 ? null : round3(s / w)
        }
        const minutes = own.reduce((s, o) => s + decay(o) * o.minutes, 0)
        const leaves = own.reduce((s, o) => s + decay(o) * o.leaves, 0)
        const signal: SlotSignal = {
          sessions: own.length,
          focus: mean(
            (o) => o.focus,
            (o) => decay(o) * (o.hard ? 0.5 : 1),
          ),
          speed: mean((o) => o.speed),
          lateShare: mean((o) =>
            o.startDelayMin === null ? null : o.startDelayMin > START_LATE_MIN ? 1 : 0,
          ),
          leavesPer30: minutes > 0 ? round3((leaves * 30) / minutes) : null,
          z: round3(z),
        }
        return [part, signal]
      }),
    ) as Record<SlotPart, SlotSignal>

  return { weekday: table('weekday'), weekend: table('weekend') }
}

/**
 * Slot scores for `placeTimes()` with the signals: one standard deviation of the combined signal
 * moves a score by `SIGNAL_STEP` (one `SLOT_GAP`), so only a clear difference changes a start.
 */
export function withSignals(scores: SlotCompletion, signals: SlotSignals): SlotCompletion {
  const shift = (kind: DayKind) =>
    Object.fromEntries(
      SLOT_PARTS.map((part) => [
        part,
        round3(Math.max(0, Math.min(1, scores[kind][part] + SIGNAL_STEP * signals[kind][part].z))),
      ]),
    ) as Record<SlotPart, number>
  return { weekday: shift('weekday'), weekend: shift('weekend') }
}

/** A saved timer session with what the signals need. */
export interface SignalSession {
  startedAt: string
  blockId: string | null
  minutes: number
  focus: number | null
  focusReasons: string[] | null
  distractions: number
  appLeaves: number
  /** Material done: minutes and amount per unit (`session_units`). */
  units: { unitId: string; minutes: number; amountDone: number | null }[]
}

/**
 * Observations from saved sessions. `expectedPerAmount` is the estimate per unit of measure of a
 * unit with its difficulty (minutes per page, per question…); `plannedStart` the planned start
 * of AI blocks with a time.
 */
export function slotObservations(
  sessions: SignalSession[],
  plannedStart: Map<string, string>,
  expectedPerAmount: Map<string, number>,
  boundary: DayBoundary,
): SlotObservation[] {
  return sessions
    .filter((s) => s.minutes > 0)
    .map((s) => {
      const at = new Date(s.startedAt)
      const onDate = localDay(at, boundary)
      let measured = 0
      let expected = 0
      for (const u of s.units) {
        const rate = expectedPerAmount.get(u.unitId)
        if (rate === undefined || !u.amountDone || u.amountDone <= 0 || u.minutes <= 0) continue
        measured += u.minutes
        expected += rate * u.amountDone
      }
      const planned = s.blockId ? plannedStart.get(s.blockId) : undefined
      const wall = wallClock(at, boundary.timeZone).minutes
      return {
        onDate,
        // Before the day boundary is still the previous day's night (PRD: noć 23–granica dana).
        part: partOf(wall < boundary.dayStartMin ? wall + 24 * 60 : wall),
        weekend: weekdayOf(onDate) >= 5,
        focus: s.focus,
        hard: (s.focusReasons ?? []).includes('hard'),
        speed: expected > 0 ? round3(measured / expected) : null,
        startDelayMin: planned ? Math.round((at.getTime() - Date.parse(planned)) / 60_000) : null,
        minutes: s.minutes,
        leaves: s.distractions + s.appLeaves,
      }
    })
}

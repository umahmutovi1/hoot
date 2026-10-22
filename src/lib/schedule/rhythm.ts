import { DAY_MINUTES, mergeSlots, type AvailabilityRule, type Slot } from '.'

/**
 * Onboarding (PRD "Onboarding" steps 3–5): the user's rhythm becomes a day boundary, a prior for
 * study slots and proposed weekly periods. Times are minutes after local midnight; a bedtime
 * before noon is after midnight (00:30 = 30 means "half past midnight").
 */

export const SLOT_PARTS = ['morning', 'midday', 'afternoon', 'evening', 'night'] as const
export type SlotPart = (typeof SLOT_PARTS)[number]

/** Parts of the day (PRD "Termini učenja"): jutro to 12, podne 12–15, popodne 15–19, veče 19–23, noć 23–24. */
export const PART_RANGES: Record<SlotPart, Slot> = {
  morning: { startMin: 0, endMin: 12 * 60 },
  midday: { startMin: 12 * 60, endMin: 15 * 60 },
  afternoon: { startMin: 15 * 60, endMin: 19 * 60 },
  evening: { startMin: 19 * 60, endMin: 23 * 60 },
  night: { startMin: 23 * 60, endMin: DAY_MINUTES },
}

export interface Rhythm {
  /** Wake-up time {weekday, weekend}. */
  wake: [number, number]
  /** Bedtime {weekday, weekend}; before noon = after midnight. */
  sleep: [number, number]
}

export const DEFAULT_RHYTHM: Rhythm = { wake: [7 * 60, 9 * 60], sleep: [23 * 60 + 30, 30] }

const NOON = 12 * 60
/** Bedtime on a 0–2880 scale, so 00:30 is later than 23:30. */
const lateness = (sleep: number) => (sleep < NOON ? sleep + DAY_MINUTES : sleep)

/** Earliest and latest day boundary the app suggests. */
const MIN_DAY_START = 4 * 60
const MAX_DAY_START = 8 * 60

/**
 * Suggested `day_start_min`: 2 h after the latest usual bedtime, at least 04:00 (studying at
 * 01:30 still belongs to the day before), at most 08:00.
 */
export function suggestDayStart(sleep: number[]): number {
  const latest = Math.max(...sleep.map(lateness))
  const after = latest + 120 - DAY_MINUTES
  return Math.min(MAX_DAY_START, Math.max(MIN_DAY_START, after))
}

/** 0–4 = Monday–Friday use the weekday rhythm, 5–6 the weekend one. */
const isWeekend = (weekday: number) => weekday >= 5

/** Awake time on one calendar day: wake-up to bedtime, at most until midnight. */
export function awakeSlot(rhythm: Rhythm, weekday: number): Slot {
  const i = isWeekend(weekday) ? 1 : 0
  const wake = rhythm.wake[i]
  const sleep = rhythm.sleep[i]
  const end = sleep < NOON || sleep <= wake ? DAY_MINUTES : sleep
  return { startMin: wake, endMin: end }
}

const intersect = (a: Slot, b: Slot): Slot | null => {
  const startMin = Math.max(a.startMin, b.startMin)
  const endMin = Math.min(a.endMin, b.endMin)
  return endMin > startMin ? { startMin, endMin } : null
}

/**
 * Proposed availability (step 4): for every day that is on, the awake time inside the chosen
 * parts of the day (all awake time when none is chosen). Classes and calendar events are not cut
 * out here: net availability subtracts them anyway.
 */
export function proposeRules(
  rhythm: Rhythm,
  parts: readonly SlotPart[],
  offDays: ReadonlySet<number> = new Set(),
): AvailabilityRule[] {
  const ranges =
    parts.length > 0 ? parts.map((p) => PART_RANGES[p]) : [{ startMin: 0, endMin: DAY_MINUTES }]
  const out: AvailabilityRule[] = []
  for (let weekday = 0; weekday < 7; weekday++) {
    if (offDays.has(weekday)) continue
    const awake = awakeSlot(rhythm, weekday)
    const slots = mergeSlots(ranges.flatMap((r) => intersect(awake, r) ?? []))
    for (const s of slots) out.push({ weekday, ...s })
  }
  return out
}

/** Default template from `handle_new_user()`: every day 06:00–24:00. */
export function isDefaultTemplate(
  rules: Pick<AvailabilityRule, 'weekday' | 'startMin' | 'endMin'>[],
) {
  return (
    rules.length === 7 &&
    rules.every((r) => r.startMin === 360 && r.endMin === DAY_MINUTES) &&
    new Set(rules.map((r) => r.weekday)).size === 7
  )
}

/** Parts of the day that hold the preferred slots, for the onboarding chips. */
export function partOf(minute: number): SlotPart {
  return (
    SLOT_PARTS.find((p) => minute >= PART_RANGES[p].startMin && minute < PART_RANGES[p].endMin) ??
    'night'
  )
}

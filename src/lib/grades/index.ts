/**
 * Points, grade scale and grade projection (PRD "Bodovi, skala ocjena i projekcija ocjene").
 * Pure functions over the stored inputs; nothing derived here is saved.
 *
 * An item is an exam or a deadline. Items are grouped into slots: an exam with its makeups is
 * one slot (the latest attempt counts), a deadline is one slot, and when an integral exam is the
 * latest attempt among the partials, it is one slot that replaces all of them.
 */

export type PointsUnit = 'points' | 'percent'
export type GradeItemKind = 'partial' | 'final' | 'integral' | 'makeup' | 'other' | 'deadline'

export interface GradeItem {
  id: string
  kind: GradeItemKind
  /** ISO timestamp; orders attempts ("zadnji izlazak") and entry conditions. */
  at: string
  pointsMax: number | null
  pointsUnit: PointsUnit
  /** Pass threshold in % of the item; null = none. */
  passMinPct: number | null
  /** Points needed from earlier items to take this exam; null = none. */
  entryMinPoints: number | null
  /** Makeups: the exam they repeat. */
  retakeOf: string | null
  resultPoints: number | null
  resultMax: number | null
  annulled: boolean
  /** Stored `passed` (exams, user-editable); null = computed from the threshold (deadlines). */
  passed: boolean | null
}

export interface GradeSubject {
  pointsTotal: number
  /** Lower bounds in % for grades 6..10; null = default scale. */
  scale: readonly number[] | null
}

/** Default Bosnian scale: 55–64 → 6, …, 95–100 → 10; below 55 → 5. */
export const DEFAULT_SCALE: readonly number[] = [55, 65, 75, 85, 95]
export const GRADES = [6, 7, 8, 9, 10] as const
export type Grade = (typeof GRADES)[number]

export function scaleOf(scale: readonly number[] | null | undefined): readonly number[] {
  return scale && isValidScale(scale) ? scale : DEFAULT_SCALE
}

/** Five thresholds in 0–100, strictly increasing. */
export function isValidScale(scale: readonly number[]): boolean {
  return (
    scale.length === 5 &&
    scale.every((n, i) => Number.isFinite(n) && n > 0 && n <= 100 && (i === 0 || n > scale[i - 1]!))
  )
}

/** Grade 5–10 for a share of the total in %. */
export function gradeFor(pct: number, scale: readonly number[]): number {
  let grade = 5
  scale.forEach((min, i) => {
    if (pct >= min - 1e-9) grade = 6 + i
  })
  return grade
}

/** Points needed for a grade (6–10). */
export function gradeThreshold(grade: number, subject: GradeSubject): number {
  const pct = scaleOf(subject.scale)[grade - 6] ?? 100
  return (pct * subject.pointsTotal) / 100
}

/** Result as a share 0–1 of the test, clamped. */
export function resultShare(item: Pick<GradeItem, 'resultPoints' | 'resultMax'>): number | null {
  if (item.resultPoints === null || item.resultMax === null || !(item.resultMax > 0)) return null
  return Math.min(1, Math.max(0, item.resultPoints / item.resultMax))
}

/** "Položeno" suggested when a result is entered: above the threshold, if there is one. */
export function suggestPassed(share: number, passMinPct: number | null): boolean {
  return passMinPct === null || share * 100 >= passMinPct - 1e-9
}

function hasResult(item: GradeItem) {
  return resultShare(item) !== null
}

/** A result that is in the sum: entered and not waived. */
export function isCounted(item: GradeItem): boolean {
  return hasResult(item) && !item.annulled
}

function isPassedAttempt(item: GradeItem): boolean {
  if (!isCounted(item)) return false
  return item.passed ?? suggestPassed(resultShare(item)!, item.passMinPct)
}

const byAttemptOrder = (a: GradeItem, b: GradeItem) =>
  a.at.localeCompare(b.at) || Number(a.kind === 'makeup') - Number(b.kind === 'makeup')

/** Root exam of a makeup chain (makeups repeat one exam). */
function rootOf(item: GradeItem, byId: Map<string, GradeItem>): GradeItem {
  let current = item
  const seen = new Set<string>()
  while (current.kind === 'makeup' && current.retakeOf && !seen.has(current.id)) {
    seen.add(current.id)
    const next = byId.get(current.retakeOf)
    if (!next) break
    current = next
  }
  return current
}

/** Points an item carries: makeups carry their exam's, the integral carries the partials' sum. */
export function itemWorth(item: GradeItem, items: readonly GradeItem[], pointsTotal: number) {
  const byId = new Map(items.map((i) => [i.id, i]))
  return worthOf(item, items, byId, pointsTotal)
}

function ownWorth(item: GradeItem, pointsTotal: number): number | null {
  if (item.pointsMax === null || !(item.pointsMax > 0)) return null
  return item.pointsUnit === 'percent' ? (item.pointsMax * pointsTotal) / 100 : item.pointsMax
}

function worthOf(
  item: GradeItem,
  items: readonly GradeItem[],
  byId: Map<string, GradeItem>,
  pointsTotal: number,
): number | null {
  const root = rootOf(item, byId)
  if (root.kind === 'integral') {
    const partials = items
      .filter((i) => i.kind === 'partial')
      .map((p) => ownWorth(p, pointsTotal))
      .filter((w): w is number => w !== null)
    if (partials.length > 0) return partials.reduce((s, w) => s + w, 0)
  }
  return ownWorth(root, pointsTotal)
}

/** Points an attempt adds: item points × result share, never more than the item carries. */
export function contribution(worth: number, item: Pick<GradeItem, 'resultPoints' | 'resultMax'>) {
  const share = resultShare(item)
  return share === null ? 0 : worth * share
}

export type SlotState = 'counted' | 'failed' | 'open'

export interface Slot {
  /** Exam or deadline the slot is shown as (the integral when it replaced the partials). */
  itemId: string
  /** Items whose points this slot stands for (the partials, when the integral counts). */
  coversIds: string[]
  worth: number
  /** Points in the sum; 0 unless counted. */
  earned: number
  /** counted = passed result in the sum; failed = below the threshold or not passed; open = none. */
  state: SlotState
  /** Attempt that decides the slot, if any. */
  attemptId: string | null
  at: string
  passMinPct: number | null
}

function chainSlot(root: GradeItem, chain: GradeItem[], worth: number, coversIds: string[]): Slot {
  const attempt = [...chain].filter(isCounted).sort(byAttemptOrder).at(-1)
  const passed = attempt !== undefined && isPassedAttempt(attempt)
  return {
    itemId: root.id,
    coversIds,
    worth,
    earned: passed ? contribution(worth, attempt) : 0,
    state: attempt === undefined ? 'open' : passed ? 'counted' : 'failed',
    attemptId: attempt?.id ?? null,
    at: (attempt ?? root).at,
    passMinPct: (attempt ?? root).passMinPct,
  }
}

/** The subject's items as slots; items without points are left out. */
export function slotsOf(items: readonly GradeItem[], pointsTotal: number): Slot[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const chains = new Map<string, GradeItem[]>()
  for (const item of items) {
    const root = rootOf(item, byId)
    chains.set(root.id, [...(chains.get(root.id) ?? []), item])
  }
  const worth = (root: GradeItem) => worthOf(root, items, byId, pointsTotal)
  const roots = [...chains.keys()].map((id) => byId.get(id)!).filter((r) => worth(r) !== null)
  const partials = roots.filter((r) => r.kind === 'partial')
  const integrals = partials.length > 0 ? roots.filter((r) => r.kind === 'integral') : []

  // Latest attempt among the partials and the integrals decides who gives the points.
  const groupLatest = [...partials, ...integrals]
    .flatMap((r) => chains.get(r.id)!)
    .filter(isCounted)
    .sort(byAttemptOrder)
    .at(-1)
  const integralRoot = groupLatest && integrals.find((r) => r.id === rootOf(groupLatest, byId).id)

  const slots: Slot[] = []
  for (const root of roots) {
    if (root.kind === 'integral' && partials.length > 0) {
      if (root === integralRoot) {
        slots.push(
          chainSlot(
            root,
            chains.get(root.id)!,
            worth(root)!,
            partials.map((p) => p.id),
          ),
        )
      }
      continue
    }
    if (root.kind === 'partial' && integralRoot) continue
    slots.push(chainSlot(root, chains.get(root.id)!, worth(root)!, [root.id]))
  }
  return slots.sort((a, b) => a.at.localeCompare(b.at))
}

export type GradeStatus =
  | { grade: number; kind: 'secured' }
  | { grade: number; kind: 'needs'; points: number; pct: number }
  | { grade: number; kind: 'unreachable' }

export interface Projection {
  /** "Imam": points of counted results. */
  have: number
  /** Points of the slots that already have a counted result ("od 54 moguća do sad"). */
  maxSoFar: number
  /** Points still to win (open and failed slots). */
  remaining: number
  /** Have + remaining. */
  maxPossible: number
  /** Slots still to win, in date order. */
  remainingSlots: Slot[]
  /** Least the remaining slots need for their own thresholds. */
  remainingMin: number
  /** Grades 6–10. */
  grades: GradeStatus[]
  slots: Slot[]
}

export function project(items: readonly GradeItem[], subject: GradeSubject): Projection {
  const slots = slotsOf(items, subject.pointsTotal)
  const done = slots.filter((s) => s.state === 'counted')
  const remainingSlots = slots.filter((s) => s.state !== 'counted')
  const have = sum(done.map((s) => s.earned))
  const remaining = sum(remainingSlots.map((s) => s.worth))
  const remainingMin = sum(remainingSlots.map((s) => (s.worth * (s.passMinPct ?? 0)) / 100))
  const grades = GRADES.map((grade): GradeStatus => {
    const need = Math.max(gradeThreshold(grade, subject) - have, remainingMin)
    if (need <= 1e-9) return { grade, kind: 'secured' }
    if (need > remaining + 1e-9) return { grade, kind: 'unreachable' }
    return { grade, kind: 'needs', points: need, pct: need / remaining }
  })
  return {
    have,
    maxSoFar: sum(done.map((s) => s.worth)),
    remaining,
    maxPossible: have + remaining,
    remainingSlots,
    remainingMin,
    grades,
    slots,
  }
}

export interface EntryCondition {
  itemId: string
  required: number
  /** Counted points from slots before the exam. */
  have: number
  missing: number
}

/** "Uslov za izlazak": counted points before each exam that has an entry condition. */
export function entryConditions(items: readonly GradeItem[], pointsTotal: number) {
  const slots = slotsOf(items, pointsTotal)
  return items
    .filter((i) => i.entryMinPoints !== null && i.entryMinPoints > 0)
    .map((i): EntryCondition => {
      const have = sum(
        slots.filter((s) => s.state === 'counted' && s.at < i.at).map((s) => s.earned),
      )
      const required = i.entryMinPoints!
      return { itemId: i.id, required, have, missing: Math.max(0, required - have) }
    })
}

export type RetakeStatus = 'done' | 'needed' | 'standby'

/**
 * A makeup is needed once its exam has a result that is waived or not passed; it is done once
 * it has a counted result of its own; otherwise it waits ("samo ako zatreba").
 */
export function retakeStatus(makeup: GradeItem, items: readonly GradeItem[]): RetakeStatus {
  if (isCounted(makeup)) return 'done'
  const target = items.find((i) => i.id === makeup.retakeOf)
  if (!target || !hasResult(target)) return 'standby'
  return target.annulled || !isPassedAttempt(target) ? 'needed' : 'standby'
}

function sum(values: number[]) {
  return values.reduce((s, v) => s + v, 0)
}

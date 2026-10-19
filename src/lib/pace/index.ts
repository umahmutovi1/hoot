/**
 * Lecture tracking (PRD "Praćenje predavanja"). A lecture log says how far a class got in one
 * source ("do ovdje"); every active unit up to that one (in outline order, with its sub-units)
 * counts as covered in class. Being behind = covered leaves the user has not started yet.
 * Minutes are the same estimates the source screen shows (`materialOf()` → `estimateUnits()`).
 */

export interface PaceUnit {
  id: string
  parentId: string | null
  /** Pre-order index in the source outline. */
  position: number
  level: number
  minutes: number
  /** Pages, slides, questions or items of the unit (source measure). */
  amount?: number
}

export interface PaceLog {
  id: string
  onDate: string
  createdAt: string
  sourceId: string | null
  upToUnitId: string | null
  cancelled: boolean
}

/** More than this many lectures with untouched material, or more than this many minutes. */
export const BEHIND_LECTURES = 2
export const BEHIND_MINUTES = 4 * 60

const chronological = (a: PaceLog, b: PaceLog) =>
  a.onDate.localeCompare(b.onDate) || a.createdAt.localeCompare(b.createdAt)

/** Logs that moved the boundary (not cancelled, with a unit), oldest first. */
export function reachedLogs(logs: PaceLog[]): PaceLog[] {
  return logs.filter((l) => !l.cancelled && l.upToUnitId !== null).sort(chronological)
}

/** The log that counts now: latest day, then latest entry. */
export function latestLog(logs: PaceLog[]): PaceLog | undefined {
  return reachedLogs(logs).at(-1)
}

function childrenMap(units: PaceUnit[]) {
  const children = new Map<string, PaceUnit[]>()
  for (const u of units) {
    if (u.parentId) children.set(u.parentId, [...(children.get(u.parentId) ?? []), u])
  }
  return children
}

/** Last position inside a unit's subtree (the unit itself when it has no sub-units). */
function subtreeEnd(units: PaceUnit[], unitId: string): number | null {
  const children = childrenMap(units)
  const root = units.find((u) => u.id === unitId)
  if (!root) return null
  let end = root.position
  const walk = (u: PaceUnit) => {
    end = Math.max(end, u.position)
    children.get(u.id)?.forEach(walk)
  }
  walk(root)
  return end
}

function leaves<T extends PaceUnit>(units: T[]): T[] {
  const parents = new Set(units.map((u) => u.parentId).filter(Boolean))
  return units.filter((u) => !parents.has(u.id)).sort((a, b) => a.position - b.position)
}

/** Leaves covered in class up to and including `upToUnitId` (with its sub-units). */
export function coveredLeaves(units: PaceUnit[], upToUnitId: string): PaceUnit[] {
  const end = subtreeEnd(units, upToUnitId)
  if (end === null) return []
  return leaves(units).filter((u) => u.position <= end)
}

/** Top-level unit (no parent) that contains the unit. */
function topOf<T extends PaceUnit>(units: T[], unitId: string): T | undefined {
  const byId = new Map(units.map((u) => [u.id, u]))
  let u = byId.get(unitId)
  while (u?.parentId && byId.has(u.parentId)) u = byId.get(u.parentId)
  return u
}

export interface SourcePace<T extends PaceUnit = PaceUnit> {
  /** Top-level unit that contains the latest lecture boundary ("Na predavanju: pogl. 5"). */
  lectureAt: T
  /** Last top-level unit the user has fully started, in order without gaps ("Ti: pogl. 3"). */
  youAt: T | null
  /** 1-based index of `lectureAt` / `youAt` among top-level units (0 = none yet). */
  lectureIndex: number
  youIndex: number
  topCount: number
  /** Minutes of covered leaves still at level 0. */
  behindMinutes: number
  /** The same leaves in the source's measure (pages, questions…). */
  behindAmount: number
  /** Lectures whose newly covered material still has a level-0 unit. */
  behindLectures: number
  latest: PaceLog
}

/** Pace of one source from its logs; null without a log that reached a unit. */
export function sourcePace<T extends PaceUnit>(units: T[], logs: PaceLog[]): SourcePace<T> | null {
  const reached = reachedLogs(logs).filter((l) => units.some((u) => u.id === l.upToUnitId))
  const latest = reached.at(-1)
  if (!latest) return null

  const tops = units.filter((u) => u.parentId === null).sort((a, b) => a.position - b.position)
  const allLeaves = leaves(units)
  const lectureAt = topOf(units, latest.upToUnitId!)!

  let youIndex = 0
  for (const top of tops) {
    const own = allLeaves.filter((l) => topOf(units, l.id)?.id === top.id)
    if (own.length === 0 || own.some((l) => l.level < 1)) break
    youIndex++
  }

  const untouched = coveredLeaves(units, latest.upToUnitId!).filter((u) => u.level === 0)
  const behindMinutes = untouched.reduce((sum, u) => sum + u.minutes, 0)
  const behindAmount = untouched.reduce((sum, u) => sum + (u.amount ?? 0), 0)

  let reachedEnd = -1
  let behindLectures = 0
  for (const log of reached) {
    const end = subtreeEnd(units, log.upToUnitId!) ?? -1
    const fresh = allLeaves.filter((u) => u.position > reachedEnd && u.position <= end)
    if (fresh.some((u) => u.level === 0)) behindLectures++
    reachedEnd = Math.max(reachedEnd, end)
  }

  return {
    lectureAt,
    youAt: youIndex > 0 ? tops[youIndex - 1]! : null,
    lectureIndex: tops.findIndex((t) => t.id === lectureAt.id) + 1,
    youIndex,
    topCount: tops.length,
    behindMinutes,
    behindAmount,
    behindLectures,
    latest,
  }
}

export interface SubjectBehind {
  behindMinutes: number
  behindLectures: number
}

export function subjectBehind(paces: (SourcePace | null)[]): SubjectBehind {
  return paces.reduce<SubjectBehind>(
    (sum, p) =>
      p
        ? {
            behindMinutes: sum.behindMinutes + p.behindMinutes,
            behindLectures: sum.behindLectures + p.behindLectures,
          }
        : sum,
    { behindMinutes: 0, behindLectures: 0 },
  )
}

export function isBehind(b: SubjectBehind): boolean {
  return b.behindLectures > BEHIND_LECTURES || b.behindMinutes > BEHIND_MINUTES
}

export type PaceAction =
  'raise_priority' | 'take_time_from' | 'switch_to_regular' | 'start_earlier' | 'add_minutes'

/** Actions that need `plan()` (a plan diff or a computed day) and wait for the scheduler. */
export const NEEDS_PLAN: ReadonlySet<PaceAction> = new Set([
  'take_time_from',
  'start_earlier',
  'add_minutes',
])

export interface PaceSubject {
  priority: number
  studyMode: 'regular' | 'campaign'
}

/**
 * Suggested actions when the subject is behind (PRD "Prijedlozi kod zaostatka"), at most 3,
 * in the order that makes sense for the subject; empty when it is not behind.
 */
export function paceActions(behind: SubjectBehind, subject: PaceSubject): PaceAction[] {
  if (!isBehind(behind)) return []
  const campaign = subject.studyMode === 'campaign'
  const actions: PaceAction[] = []
  if (subject.priority < 5) actions.push('raise_priority')
  if (campaign) actions.push('switch_to_regular', 'start_earlier')
  actions.push('take_time_from', 'add_minutes')
  return actions.slice(0, 3)
}

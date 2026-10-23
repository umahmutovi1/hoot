import type { Tables } from '@/types/database'
import { blendedRate, DEFAULT_MEASURE, estimateUnits, speedFactor } from '@/lib/estimates'
import { MEASURES, type Measure } from '@/lib/outline/parse'
import {
  EMPTY_PROGRESS,
  leavesOf,
  progressOf,
  subjectProgress,
  subtreeLeaves,
  type Progress,
  type ProgressUnit,
} from '@/lib/progress'
import { scopeOf, type ScopeRow } from '@/lib/progress/scope'
import type { Assessment } from '@/features/subjects/model'

export type Source = Tables<'sources'>
export type Unit = Tables<'units'>
export type Topic = Tables<'topics'>
export type UnitTopic = Tables<'unit_topics'>
export type Card = Tables<'cards'>
export type AssessmentUnit = Tables<'assessment_units'>

/** Memory columns of a unit or card that has not been tested yet. */
export const NO_MEMORY = {
  fsrs_stability: null,
  fsrs_difficulty: null,
  fsrs_state: null,
  fsrs_reps: 0,
  fsrs_lapses: 0,
  review_streak: 0,
  last_review_at: null,
} as const

export type SourceWithUnits = Source & { units: Unit[] }
export type TopicWithUnits = Topic & { unit_topics: UnitTopic[] }

export const SOURCE_KINDS = ['book', 'script', 'questions', 'slides', 'other'] as const

export function measureOf(source: Pick<Source, 'measure' | 'kind'>): Measure {
  return MEASURES.includes(source.measure as Measure)
    ? (source.measure as Measure)
    : DEFAULT_MEASURE[source.kind]
}

/** Measures `other` sources can use; every other kind has exactly one. */
export const OTHER_MEASURES = ['pages', 'items'] as const satisfies Measure[]

/**
 * Levels a unit can have. Chapters: 0 not started, 1 read, 2 understood, 3 reviewed.
 * Questions: 0 don't know, 1 partly, 3 know (so "know" is always 100%).
 */
export function levelsFor(kind: Unit['kind']): number[] {
  return kind === 'question' ? [0, 1, 3] : [0, 1, 2, 3]
}

export function activeUnits(source: SourceWithUnits): Unit[] {
  return source.units.filter((u) => u.archived_at === null).sort((a, b) => a.position - b.position)
}

export function archivedUnits(source: SourceWithUnits): Unit[] {
  return source.units.filter((u) => u.archived_at !== null).sort((a, b) => a.position - b.position)
}

/** Units under an active parent chain; an archived parent hides its children too. */
function visibleUnits(source: SourceWithUnits): Unit[] {
  const active = new Map(activeUnits(source).map((u) => [u.id, u]))
  return [...active.values()].filter((u) => {
    let p = u.parent_id
    while (p) {
      const parent = active.get(p)
      if (!parent) return false
      p = parent.parent_id
    }
    return true
  })
}

export interface SourceMaterial {
  source: SourceWithUnits
  /** Active units in order, with estimated minutes and difficulty. */
  units: (Unit & { minutes: number; difficulty: number })[]
  progress: Progress
}

/**
 * Estimates and progress of one source; computed, never stored. `speed` is the personal speed
 * factor (PRD "Procjena" → 5) that scales the heuristic before measurements take over.
 */
export function materialOf(source: SourceWithUnits, speed = 1): SourceMaterial {
  const units = visibleUnits(source)
  const rate = blendedRate(
    source.base_min_per_unit * speed,
    source.learned_min_per_unit,
    source.learned_samples,
  )
  const estimates = estimateUnits(
    units.map((u) => ({
      id: u.id,
      amount: Number(u.amount),
      priorDifficulty: u.ai_difficulty,
      userDifficulty: u.user_difficulty,
    })),
    rate,
  )
  const withMinutes = units.map((u) => ({ ...u, ...estimates.get(u.id)! }))
  return { source, units: withMinutes, progress: progressOf(leavesOf(asProgress(withMinutes))) }
}

/** The speed factor of one source among all the user's sources. */
export function speedOf(source: Source, all: Source[]): number {
  return speedFactor(
    all.map((s) => ({
      id: s.id,
      kind: s.kind,
      base: s.base_min_per_unit,
      learned: s.learned_min_per_unit === null ? null : Number(s.learned_min_per_unit),
      samples: s.learned_samples,
    })),
    source.kind,
    source.id,
  )
}

export function asProgress(units: (Unit & { minutes: number })[]): ProgressUnit[] {
  return units.map((u) => ({ id: u.id, parentId: u.parent_id, level: u.level, minutes: u.minutes }))
}

/** Progress of a unit; a parent's comes from its sub-units. */
export function unitProgress(material: SourceMaterial, unitId: string): Progress {
  return progressOf(subtreeLeaves(asProgress(material.units), unitId))
}

export function subjectMaterialProgress(materials: SourceMaterial[]): number {
  return subjectProgress(materials.map((m) => ({ weight: m.source.weight, progress: m.progress })))
}

export function toScopeRows(rows: AssessmentUnit[]): ScopeRow[] {
  return rows.map((r) => ({
    assessmentId: r.assessment_id,
    unitId: r.unit_id,
    included: r.included,
  }))
}

/** Progress over the exam's scope across all the subject's sources. */
export function examProgress(
  exam: Pick<Assessment, 'id' | 'scope_all'>,
  materials: SourceMaterial[],
  rows: ScopeRow[],
): Progress {
  const units = materials.flatMap((m) => asProgress(m.units))
  if (units.length === 0) return EMPTY_PROGRESS
  const inScope = scopeOf({ id: exam.id, scopeAll: exam.scope_all }, units, rows)
  return progressOf(leavesOf(units).filter((u) => inScope.has(u.id)))
}

/** "1h 52", "45 min" */
export function formatMinutes(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes))
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

export function topicsOfUnit(unitId: string, topics: TopicWithUnits[]): TopicWithUnits[] {
  return topics.filter((t) => t.unit_topics.some((l) => l.unit_id === unitId))
}

/**
 * Units of the other kind (chapter ↔ question) that share at least one topic with the unit:
 * "Povezana ispitna pitanja" on a chapter, related chapters on a question.
 */
export function relatedUnits(unit: Unit, topics: TopicWithUnits[], units: Unit[]): Unit[] {
  const shared = new Set(
    topicsOfUnit(unit.id, topics).flatMap((t) => t.unit_topics.map((l) => l.unit_id)),
  )
  return units.filter(
    (u) =>
      u.id !== unit.id &&
      shared.has(u.id) &&
      u.archived_at === null &&
      (u.kind === 'question') !== (unit.kind === 'question'),
  )
}

/** "I parcijala" → "I", "II parcijala" → "II"; other titles stay as they are. */
export function shortExamLabel(title: string): string {
  const roman = /^([IVX]+)\b/.exec(title.trim())
  return roman ? roman[1]! : title
}

/** Exams that take part of the material: the ones the ObimIspita segments choose between. */
export function partialExams<T extends Pick<Assessment, 'scope_all' | 'at'>>(exams: T[]): T[] {
  return exams.filter((e) => !e.scope_all).sort((a, b) => a.at.localeCompare(b.at))
}

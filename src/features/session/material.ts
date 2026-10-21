import { isMeasured, type LearnedRate, type StudyMode } from '@/lib/estimates/calibration'
import { blendedRate } from '@/lib/estimates'
import type { Measure } from '@/lib/outline/parse'
import { leavesOf } from '@/lib/progress'
import {
  asProgress,
  materialOf,
  measureOf,
  type SourceMaterial,
  type SourceWithUnits,
} from '@/features/sources/model'
import type { ModeRate } from './api'
import type { EndSource } from './end'

export type MaterialUnit = SourceMaterial['units'][number]

/** A subject's source as the session sees it: leaves in order (status lives on leaves). */
export interface SessionSource {
  source: SourceWithUnits
  measure: Measure
  leaves: MaterialUnit[]
  /** 3+ finished sessions: the source may show its own estimates (PRD "Prije mjerenja"). */
  measured: boolean
}

export function sessionSources(sources: SourceWithUnits[]): SessionSource[] {
  return sources
    .map((source) => {
      const material = materialOf(source)
      const leafIds = new Set(leavesOf(asProgress(material.units)).map((u) => u.id))
      return {
        source,
        measure: measureOf(source),
        leaves: material.units.filter((u) => leafIds.has(u.id)),
        measured: isMeasured(source.measured_sessions),
      }
    })
    .filter((s) => s.leaves.length > 0)
}

export function unitTitle(u: Pick<MaterialUnit, 'label' | 'title'>) {
  return u.label ? `${u.label} ${u.title}` : u.title
}

export function findUnit(sources: SessionSource[], unitId: string | null | undefined) {
  if (!unitId) return null
  for (const s of sources) {
    const unit = s.leaves.find((u) => u.id === unitId)
    if (unit) return { source: s, unit }
  }
  return null
}

/** Where to continue: from the first unit not started (first pass), else from the start. */
export function nextLeaves(s: SessionSource, count: number): MaterialUnit[] {
  const i = s.leaves.findIndex((u) => u.level === 0)
  const from = i < 0 ? 0 : i
  return s.leaves.slice(from, from + count)
}

function pairOf(rates: ModeRate[] | undefined, sourceId: string, mode: StudyMode | null) {
  if (!rates || !mode) return null
  const row = rates.find((r) => r.source_id === sourceId && r.mode === mode)
  return row ? { rate: Number(row.min_per_unit), samples: row.samples } : { rate: null, samples: 0 }
}

/** Inputs for `planEnd()`; `rates` undefined = calibration per mode not loaded (offline). */
export function toEndSources(
  sources: SessionSource[],
  rates: ModeRate[] | undefined,
  mode: StudyMode | null,
): EndSource[] {
  return sources.map(({ source, measure, leaves }) => {
    const learned: LearnedRate = {
      rate: source.learned_min_per_unit === null ? null : Number(source.learned_min_per_unit),
      samples: source.learned_samples,
    }
    return {
      id: source.id,
      measure,
      rate: blendedRate(source.base_min_per_unit, learned.rate, learned.samples),
      learned,
      measuredSessions: source.measured_sessions,
      pair: pairOf(rates, source.id, mode),
      units: leaves.map((u) => ({
        id: u.id,
        kind: u.kind,
        amount: Number(u.amount),
        level: u.level,
        difficulty: u.difficulty,
        completedAt: u.completed_at,
      })),
    }
  })
}

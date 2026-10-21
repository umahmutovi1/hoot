import { calibrate, type SessionSample, type StudyMode } from '@/lib/estimates/calibration'
import { supabase } from '@/lib/supabase'
import type { Op } from '@/lib/sync'
import type { SourceWithUnits } from '@/features/sources/model'
import { sessionSources } from './material'

/**
 * Speed calibration of a subject's sources, recomputed from every saved timer session (PRD
 * decision after Stage 7). Reads the server, so it runs only online with an empty queue; the
 * columns on `sources` and `source_mode_rates` are a cache of this result.
 */
export async function recalibrationOps(subjectId: string): Promise<Op[]> {
  const { data: sources, error } = await supabase
    .from('sources')
    .select('*, units(*)')
    .eq('subject_id', subjectId)
  if (error) throw error
  const sourceIds = sources.map((s) => s.id)
  if (sourceIds.length === 0) return []

  const { data: rows, error: rowsError } = await supabase
    .from('session_units')
    .select(
      'session_id, unit_id, minutes, amount_done, difficulty, study_sessions!inner(mode, origin, subject_id)',
    )
    .eq('study_sessions.subject_id', subjectId)
    .eq('study_sessions.origin', 'timer')
  if (rowsError) throw rowsError

  const { data: pairs, error: pairsError } = await supabase
    .from('source_mode_rates')
    .select('source_id, mode')
    .in('source_id', sourceIds)
  if (pairsError) throw pairsError

  // Unit → source and estimated difficulty (for samples saved without a rating).
  const units = new Map<string, { sourceId: string; difficulty: number }>()
  for (const s of sessionSources(sources as SourceWithUnits[]))
    for (const u of s.leaves) units.set(u.id, { sourceId: s.source.id, difficulty: u.difficulty })

  const samples: SessionSample[] = []
  for (const r of rows) {
    const unit = units.get(r.unit_id)
    if (!unit) continue
    samples.push({
      sourceId: unit.sourceId,
      sessionId: r.session_id,
      mode: (r.study_sessions.mode as StudyMode | null) ?? null,
      minutes: Number(r.minutes),
      amountDone: Number(r.amount_done ?? 0),
      difficulty: r.difficulty ?? unit.difficulty,
    })
  }
  const result = calibrate(samples)

  const ops: Op[] = []
  for (const id of sourceIds) {
    const c = result.get(id)
    ops.push({
      kind: 'update',
      table: 'sources',
      match: { id },
      patch: {
        learned_min_per_unit: c?.learned.rate ?? null,
        learned_samples: c?.learned.samples ?? 0,
        measured_sessions: c?.measuredSessions ?? 0,
      },
    })
    const modes = c ? [...c.pairs] : []
    if (modes.length > 0)
      ops.push({
        kind: 'upsert',
        table: 'source_mode_rates',
        onConflict: 'source_id,mode',
        rows: modes.map(([mode, rate]) => ({
          source_id: id,
          mode,
          min_per_unit: rate.rate,
          samples: rate.samples,
        })),
      })
    for (const p of pairs.filter((p) => p.source_id === id && !c?.pairs.has(p.mode)))
      ops.push({
        kind: 'delete',
        table: 'source_mode_rates',
        match: { source_id: id, mode: p.mode },
      })
  }
  return ops
}

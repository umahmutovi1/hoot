// A unit's source text as the tutor reads it: the unit with its sub-units, passages in outline
// order with [p. N] markers (`materialText`). Read as the user (RLS).
import type { SupabaseClient } from '@supabase/supabase-js'
import { materialText, type Passage } from './materialPrompts.ts'

interface UnitRow {
  id: string
  parent_id: string | null
  source_id: string
  position: number
  label: string | null
  title: string
}

export interface UnitText {
  subject: string
  title: string
  label: string | null
  /** '' when the unit has no source text. */
  text: string
}

function family(root: UnitRow, all: UnitRow[]): UnitRow[] {
  const children = new Map<string, UnitRow[]>()
  for (const u of all)
    if (u.parent_id) children.set(u.parent_id, [...(children.get(u.parent_id) ?? []), u])
  const out: UnitRow[] = []
  const walk = (u: UnitRow) => {
    out.push(u)
    for (const c of (children.get(u.id) ?? []).sort((a, b) => a.position - b.position)) walk(c)
  }
  walk(root)
  return out
}

export async function loadUnitText(db: SupabaseClient, unitId: string): Promise<UnitText | null> {
  const { data: unit } = await db
    .from('units')
    .select('id, parent_id, source_id, position, label, title, sources(subjects(name))')
    .eq('id', unitId)
    .maybeSingle<UnitRow & { sources: { subjects: { name: string } | null } | null }>()
  if (!unit) return null
  const { data: all } = await db
    .from('units')
    .select('id, parent_id, source_id, position, label, title')
    .eq('source_id', unit.source_id)
    .is('archived_at', null)
  const ids = family(unit, (all ?? []) as UnitRow[]).map((u) => u.id)
  const { data: passages, error } = await db
    .from('source_chunks')
    .select('unit_id, page, position, content')
    .in('unit_id', ids)
    .order('position')
  if (error) throw error
  return {
    subject: unit.sources?.subjects?.name ?? '',
    title: unit.title,
    label: unit.label,
    text: materialText((passages ?? []) as Passage[], ids),
  }
}

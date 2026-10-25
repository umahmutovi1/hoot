import type { TablesInsert } from '@/types/database'
import { baseMinPerUnit } from '@/lib/estimates'
import type { MergedUnit, StoredUnit } from '@/lib/outline/merge'
import type { FormattableUnit, Measure, OutlineUnit } from '@/lib/outline/parse'
import { measureOf, type Source, type Unit } from './model'
import type { SourceForm } from './schemas'

export function toSourceRow(form: SourceForm): TablesInsert<'sources'> {
  return {
    id: form.id,
    subject_id: form.subjectId,
    kind: form.kind,
    title: form.title,
    measure: form.measure,
    base_min_per_unit:
      form.measure === 'items' && form.minutesPerItem !== null
        ? form.minutesPerItem
        : baseMinPerUnit(form.kind, form.measure),
    ...(form.fileName !== undefined ? { file_name: form.fileName } : {}),
    ...(form.driveFileId !== undefined ? { drive_file_id: form.driveFileId } : {}),
    ...(form.externalUrl !== undefined ? { external_url: form.externalUrl } : {}),
  }
}

export function sourceToForm(source: Source): SourceForm {
  const measure = measureOf(source)
  return {
    id: source.id,
    subjectId: source.subject_id,
    kind: source.kind,
    title: source.title,
    measure,
    minutesPerItem: measure === 'items' ? Number(source.base_min_per_unit) : null,
  }
}

/** Rows for the merged outline; level, notes, ratings and SRS columns are never written here. */
export function toUnitRows(
  sourceId: string,
  measure: Measure,
  units: MergedUnit[],
): TablesInsert<'units'>[] {
  return units.map((u) => ({
    id: u.id,
    source_id: sourceId,
    parent_id: u.parentId,
    kind: measure === 'questions' ? 'question' : 'chapter',
    position: u.position,
    label: u.label,
    title: u.title,
    page_start: u.pageStart,
    page_end: u.pageEnd,
    amount: u.amount,
    ai_difficulty: u.difficulty === null ? null : Math.round(u.difficulty),
    archived_at: null,
  }))
}

export function toStoredUnits(units: Unit[]): StoredUnit[] {
  return units.map((u) => ({
    id: u.id,
    label: u.label,
    title: u.title,
    parentId: u.parent_id,
    pageStart: u.page_start,
    pageEnd: u.page_end,
    amount: Number(u.amount),
    difficulty: u.ai_difficulty,
    archived: u.archived_at !== null,
  }))
}

/** Active units in outline order, for the "Uredi sadržaj" text editor. */
export function toFormattable(units: Unit[]): FormattableUnit[] {
  return units.map((u) => ({
    label: u.label,
    title: u.title,
    pageStart: u.page_start,
    pageEnd: u.page_end,
    amount: Number(u.amount),
  }))
}

/**
 * Text lines carry no difficulty, so re-entered units keep the one they had (by label); the
 * review then shows and edits it like a fresh one.
 */
export function carryDifficulty(units: OutlineUnit[], existing: Unit[]): OutlineUnit[] {
  const byLabel = new Map(existing.map((u) => [u.label, u.ai_difficulty]))
  return units.map((u) =>
    u.difficulty === null ? { ...u, difficulty: byLabel.get(u.label) ?? null } : u,
  )
}

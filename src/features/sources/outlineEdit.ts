import {
  formatOutline,
  parseOutline,
  type Measure,
  type OutlineUnit,
  type ParsedOutline,
} from '@/lib/outline/parse'

/**
 * Edits in the review list go back through the parser, so sub-units, derived end pages and
 * warnings stay consistent with what the text would give. Difficulty is carried by label.
 */
export function reparse(units: OutlineUnit[], measure: Measure): ParsedOutline {
  const difficulty = new Map(units.map((u) => [u.label, u.difficulty]))
  const out = parseOutline(formatOutline(units, measure), measure)
  return {
    units: out.units.map((u) => ({ ...u, difficulty: difficulty.get(u.label) ?? null })),
    warnings: out.warnings,
  }
}

/** The unit and all of its sub-units. */
export function subtreeLabels(units: OutlineUnit[], label: string): Set<string> {
  const out = new Set([label])
  for (const u of units) if (u.parentLabel && out.has(u.parentLabel)) out.add(u.label)
  return out
}

export function removeUnit(units: OutlineUnit[], label: string, measure: Measure): ParsedOutline {
  const gone = subtreeLabels(units, label)
  return reparse(
    units.filter((u) => !gone.has(u.label)),
    measure,
  )
}

export interface UnitEdit {
  label: string
  title: string
  pageStart: number | null
  pageEnd: number | null
}

/**
 * Replaces the unit `previousLabel` or, without it, inserts a new one: after the last
 * sub-unit of its numeric parent when that exists, otherwise at the end.
 */
export function upsertUnit(
  units: OutlineUnit[],
  edit: UnitEdit,
  previousLabel: string | null,
  measure: Measure,
): ParsedOutline {
  const next: OutlineUnit = {
    label: edit.label,
    title: edit.title,
    parentLabel: null,
    depth: 0,
    pageStart: edit.pageStart,
    pageEnd: edit.pageEnd,
    pageEndDerived: false,
    amount: 1,
    amountGuessed: edit.pageStart === null || edit.pageEnd === null,
    difficulty: null,
  }
  if (previousLabel !== null) {
    return reparse(
      units.map((u) =>
        u.label === previousLabel ? { ...next, difficulty: u.difficulty, amount: u.amount } : u,
      ),
      measure,
    )
  }
  const parentLabel = edit.label.includes('.') ? edit.label.replace(/\.[^.]+$/, '') : null
  const parent = parentLabel ? units.findIndex((u) => u.label === parentLabel) : -1
  if (parent < 0) return reparse([...units, next], measure)
  const family = subtreeLabels(units, parentLabel!)
  let at = parent
  while (at + 1 < units.length && family.has(units[at + 1]!.label)) at++
  return reparse([...units.slice(0, at + 1), next, ...units.slice(at + 1)], measure)
}

/** Suggested label for a new top-level unit: one after the highest numeric one. */
export function nextLabel(units: OutlineUnit[], measure: Measure): string {
  const numbers = units
    .filter((u) => u.depth === 0)
    .map((u) => Number(u.label.replace(/^P/, '')))
    .filter(Number.isFinite)
  const n = numbers.length ? Math.max(...numbers) + 1 : units.length + 1
  return measure === 'questions' ? `P${n}` : String(n)
}

/** 1 → 2 → … → 5 → 1; unset counts as 3. */
export function cycleDifficulty(d: number | null): number {
  return ((d ?? 3) % 5) + 1
}

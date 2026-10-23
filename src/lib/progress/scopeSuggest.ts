import type { ScopeChoice } from './scope'

/**
 * AI prijedlog obima (PRD "Obim ispita", odluka Etapa 10): a rule, no LLM call. The top-level
 * units of each source are split in order into equal parts by minutes, one part per partial exam
 * (I = the first part). When a whole-material exam (final, integral) follows and there is only one
 * partial, the material is split in two and the second half is left to that exam. Exam questions
 * follow the chapters they are linked to. Units that already have rows are never suggested.
 */

export interface SuggestUnit {
  id: string
  /** Minutes of the unit with its sub-units. */
  minutes: number
}

export interface SuggestSource {
  kind: 'chapters' | 'questions'
  /** Top-level units in outline order. */
  units: SuggestUnit[]
}

export interface SuggestInput {
  /** Partial exams (without `scope_all`), by date. */
  partialIds: string[]
  hasWholeExam: boolean
  sources: SuggestSource[]
  /** Question id → top-level chapter ids it is linked to. */
  chaptersOf: Map<string, Set<string>>
  /** Units that already have scope rows (AI or the user's): left as they are. */
  assigned: Set<string>
}

export function suggestScope(input: SuggestInput): Map<string, ScopeChoice> {
  const out = new Map<string, ScopeChoice>()
  const { partialIds } = input
  if (partialIds.length === 0) return out
  const parts = input.hasWholeExam && partialIds.length === 1 ? 2 : partialIds.length

  // Chapter → partial index (also for assigned chapters: their questions follow the same split).
  const partOf = new Map<string, number>()
  for (const source of input.sources) {
    if (source.kind !== 'chapters') continue
    const total = source.units.reduce((s, u) => s + Math.max(0, u.minutes), 0)
    let before = 0
    source.units.forEach((u, i) => {
      const m = Math.max(0, u.minutes)
      // The middle of the unit decides its part; without minutes, its position does.
      const at = total > 0 ? (before + m / 2) / total : (i + 0.5) / source.units.length
      before += m
      partOf.set(u.id, Math.min(parts - 1, Math.floor(at * parts)))
    })
  }

  const choiceFor = (indices: Set<number>): ScopeChoice | null => {
    const examIds = partialIds.filter((_, i) => indices.has(i))
    return examIds.length > 0 ? { kind: 'exams', examIds } : null
  }

  for (const source of input.sources)
    for (const u of source.units) {
      if (input.assigned.has(u.id)) continue
      const indices = new Set<number>()
      if (source.kind === 'chapters') {
        const p = partOf.get(u.id)
        if (p !== undefined) indices.add(p)
      } else
        for (const c of input.chaptersOf.get(u.id) ?? []) {
          const p = partOf.get(c)
          if (p !== undefined) indices.add(p)
        }
      const choice = choiceFor(indices)
      if (choice) out.set(u.id, choice)
    }
  return out
}

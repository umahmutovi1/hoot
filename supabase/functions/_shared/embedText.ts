// What text stands for a unit, card or topic in its gte-small vector, and how many rows fit
// in one call. gte-small reads ~512 tokens, and two 1000-character texts are what one Edge
// Function call reliably embeds within its CPU limit (see EMBED_BATCH).
import type { EmbedKind } from './schemas.ts'

export const EMBED_TEXT_CHARS = 1000
export const EMBED_CALL_CHARS = 2000

export interface EmbedSourceRow {
  kind: EmbedKind
  id: string
  /** units: title + notes; cards: front + back; topics: name. */
  parts: (string | null)[]
}

export function embedText(row: EmbedSourceRow): string {
  const text = row.parts
    .map((p) => p?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
  return text.slice(0, EMBED_TEXT_CHARS)
}

/** Rows in order until the character budget is used; always at least one. */
export function takeByBudget<T>(
  rows: T[],
  length: (row: T) => number,
  budget = EMBED_CALL_CHARS,
): T[] {
  const out: T[] = []
  let used = 0
  for (const row of rows) {
    const n = length(row)
    if (out.length > 0 && used + n > budget) break
    out.push(row)
    used += n
  }
  return out
}

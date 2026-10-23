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

/** Word stems for a rough lexical check: lowercase, no diacritics, first 5 letters of 4+ letter words. */
export function stems(text: string): Set<string> {
  const plain = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj')
  return new Set((plain.match(/[a-z0-9]{4,}/g) ?? []).map((w) => w.slice(0, 5)))
}

/** gte-small alone puts unrelated Bosnian text around 0.8; this close it is the same thing. */
export const SURE_SIMILARITY = 0.9
/** Common words that say nothing about the topic. */
const STOP = new Set(['gdje', 'sam', 'pisal', 'pisao', 'about', 'where', 'what', 'kako', 'sta'])

/**
 * Notes search (no LLM): vector hits are kept when they share a word stem with the query or are
 * nearly identical in meaning; shared stems rank first.
 */
export function rankNotes<T extends { similarity: number; text: string }>(
  query: string,
  hits: T[],
  limit = 5,
): T[] {
  const wanted = [...stems(query)].filter((s) => !STOP.has(s))
  return hits
    .map((h) => {
      const have = stems(h.text)
      return { h, shared: wanted.filter((s) => have.has(s)).length }
    })
    .filter(({ h, shared }) => shared > 0 || h.similarity >= SURE_SIMILARITY)
    .sort((a, b) => b.shared - a.shared || b.h.similarity - a.h.similarity)
    .slice(0, limit)
    .map(({ h }) => h)
}

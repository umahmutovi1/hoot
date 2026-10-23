/**
 * Topic dedupe without an LLM call (PRD "Embeddings bez LLM-a"): a topic name from an import is
 * mapped to an existing topic of the subject when the names match ignoring case and spacing, or
 * when their gte-small vectors are nearly the same ("Fourierova transformacija" ↔ "Fourierove
 * transformacije"). Everything else becomes a new topic.
 */

/** gte-small puts unrelated short phrases around 0.8; near-identical wording is above this. */
export const SAME_TOPIC = 0.93

export function topicKey(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb)
}

export interface KnownTopic {
  id: string
  name: string
  /** null = not embedded yet; then only the exact name matches. */
  vector: number[] | null
}

/** Names that need a vector to be compared: no exact match among the known topics. */
export function unmatchedNames(names: string[], known: KnownTopic[]): string[] {
  const keys = new Set(known.map((t) => topicKey(t.name)))
  const out = new Map<string, string>()
  for (const n of names) {
    const key = topicKey(n)
    if (!keys.has(key) && !out.has(key)) out.set(key, n.trim())
  }
  return [...out.values()]
}

/**
 * Name (by key) → existing topic id, or null for a new topic. New names that are the same as each
 * other end up under one new topic: the caller creates it once per key.
 */
export function matchTopics(
  names: string[],
  known: KnownTopic[],
  vectors: Map<string, number[]>,
  threshold = SAME_TOPIC,
): Map<string, string | null> {
  const byKey = new Map(known.map((t) => [topicKey(t.name), t.id]))
  const out = new Map<string, string | null>()
  for (const name of names) {
    const key = topicKey(name)
    if (out.has(key)) continue
    const exact = byKey.get(key)
    if (exact) {
      out.set(key, exact)
      continue
    }
    const v = vectors.get(key)
    let best: { id: string; score: number } | null = null
    if (v)
      for (const t of known) {
        if (!t.vector) continue
        const score = cosine(v, t.vector)
        if (score >= threshold && (!best || score > best.score)) best = { id: t.id, score }
      }
    out.set(key, best?.id ?? null)
  }
  return out
}

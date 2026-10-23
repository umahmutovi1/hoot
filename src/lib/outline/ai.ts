import { formatOutline, parseOutline, type Measure, type ParsedOutline } from './parse'

/**
 * AI import → the same outline as manual entry (PRD "Ponovni uvoz"), so review, merge and saving
 * are shared. Units go through the line parser: sub-units by dotted labels, derived end pages and
 * warnings stay consistent with typed text. Difficulty and topics are carried by label.
 */

export interface AiOutlineUnit {
  label: string
  title: string
  page_start?: number | null
  page_end?: number | null
  ai_difficulty?: number | null
  topics: string[]
}

export interface AiOutline {
  outline: ParsedOutline
  /** label → topic names */
  topics: Record<string, string[]>
}

/** Labels the line parser reads as labels: `4`, `4.1`, `P8`, `L1`. */
const PARSEABLE = /^(?:\p{L}{1,3})?\d+(?:\.\d+)*$/u

export function fromAi(units: AiOutlineUnit[], measure: Measure): AiOutline {
  const topLevel = { n: 0 }
  const lines = units.map((u, i) => {
    const label = PARSEABLE.test(u.label) ? u.label : fallbackLabel(measure, ++topLevel.n)
    let pageEnd = u.page_end ?? null
    // A slide number alone means a count to the parser, so slides always get a range.
    if (measure === 'slides' && u.page_start != null && pageEnd === null) {
      const next = units.slice(i + 1).find((n) => n.page_start != null)
      pageEnd = next ? Math.max(u.page_start, next.page_start! - 1) : u.page_start
    }
    return { source: u, label, pageStart: u.page_start ?? null, pageEnd }
  })
  const text = formatOutline(
    lines.map((l) => ({
      label: l.label,
      title: l.source.title.replace(/\s+/g, ' ').trim(),
      pageStart: l.pageStart,
      pageEnd: l.pageEnd,
      amount: 1,
      amountGuessed: true,
    })),
    measure,
  )
  const parsed = parseOutline(text, measure)
  // Parsing keeps the order; a renamed duplicate keeps the original's difficulty and topics.
  const topics: Record<string, string[]> = {}
  const units2 = parsed.units.map((u, i) => {
    const from = lines[i]?.source
    if (from) topics[u.label] = from.topics
    return { ...u, difficulty: from?.ai_difficulty ?? null }
  })
  return { outline: { units: units2, warnings: parsed.warnings }, topics }
}

/** Difficulty and topics from a rating of an existing outline ("Procijeni težinu AI-jem"). */
export function withRatings(
  outline: ParsedOutline,
  rated: AiOutlineUnit[],
): { outline: ParsedOutline; topics: Record<string, string[]> } {
  const byLabel = new Map(rated.map((u) => [u.label, u]))
  const topics: Record<string, string[]> = {}
  const units = outline.units.map((u) => {
    const r = byLabel.get(u.label)
    if (!r) return u
    topics[u.label] = r.topics
    return { ...u, difficulty: r.ai_difficulty ?? u.difficulty }
  })
  return { outline: { ...outline, units }, topics }
}

function fallbackLabel(measure: Measure, n: number) {
  return measure === 'questions' ? `P${n}` : String(n)
}

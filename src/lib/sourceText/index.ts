import { chunkPages, type PageText } from '@/lib/documents/chunk'

// Tekst izvora (PRD "Tekst izvora, sažetak i kartice", Sprint 18): the PDF's text split per unit
// by the unit's page range, as passages that never cross a page. Units count pages as the book
// prints them; the PDF has front matter before the book's page 1, so the two differ by an offset.

/** A leaf unit of the source, in outline order, with the book's page range. */
export interface TextUnit {
  id: string
  title: string
  pageStart: number | null
  pageEnd: number | null
}

export interface UnitChunk {
  unitId: string
  /** The book's page. */
  page: number
  position: number
  content: string
}

/** How the book's page 1 is found in the PDF, and whether Hoot is sure about it. */
export interface PageOffset {
  /** PDF page = book page + offset. */
  offset: number
  /** From the PDF's page labels or from unit titles found on their pages. */
  sure: boolean
}

/** Front matter longer than this is not looked for. */
const MAX_OFFSET = 60

const normalize = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** The unit's title without its number ("4.2 Fourierov red" → "fourierov red"). */
const titleWords = (title: string) => normalize(title.replace(/^[\d.\sIVXLC]+(?=\p{L})/u, ''))

/** Book page 1 from the PDF's page labels ("i", "ii", "1"): the index of the label "1". */
export function offsetFromPageLabels(labels: readonly string[] | null): number | null {
  if (!labels) return null
  const at = labels.findIndex((l) => l.trim() === '1')
  return at >= 0 ? at : null
}

/**
 * The offset: the PDF's page labels when it has them, else the offset under which most unit
 * titles appear on their first page (at least two, or the only unit), else 0, not sure.
 */
export function pageOffset(
  pages: readonly PageText[],
  units: readonly TextUnit[],
  labels: readonly string[] | null = null,
): PageOffset {
  const fromLabels = offsetFromPageLabels(labels)
  if (fromLabels !== null) return { offset: fromLabels, sure: true }
  const text = new Map(pages.map((p) => [p.page, normalize(p.text)]))
  const titled = units
    .filter((u) => u.pageStart !== null)
    .map((u) => ({ page: u.pageStart!, words: titleWords(u.title) }))
    .filter((u) => u.words.length >= 4)
  let best = { offset: 0, hits: 0 }
  for (let offset = 0; offset <= MAX_OFFSET; offset++) {
    const hits = titled.filter((u) => text.get(u.page + offset)?.includes(u.words)).length
    if (hits > best.hits) best = { offset, hits }
  }
  const enough = best.hits >= Math.min(2, titled.length) && best.hits > 0
  return enough ? { offset: best.offset, sure: true } : { offset: 0, sure: false }
}

/**
 * The book pages of each unit: its own range, or up to the page before the next unit starts
 * (the last one ends on its first page). Units without a first page get none.
 */
export function unitRanges(units: readonly TextUnit[]): Map<string, { from: number; to: number }> {
  const out = new Map<string, { from: number; to: number }>()
  units.forEach((u, i) => {
    if (u.pageStart === null) return
    const next = units.slice(i + 1).find((n) => n.pageStart !== null)?.pageStart ?? null
    const to = u.pageEnd ?? (next !== null ? Math.max(u.pageStart, next - 1) : u.pageStart)
    out.set(u.id, { from: u.pageStart, to: Math.max(u.pageStart, to) })
  })
  return out
}

/**
 * Passages per unit from the PDF's pages: each unit's book pages, read at `offset`, cut into
 * passages (`chunkPages`). A page two units share goes to both.
 */
export function unitChunks(
  pages: readonly PageText[],
  units: readonly TextUnit[],
  offset: number,
): UnitChunk[] {
  const byPdfPage = new Map(pages.map((p) => [p.page, p.text]))
  const out: UnitChunk[] = []
  for (const [unitId, range] of unitRanges(units)) {
    const own: PageText[] = []
    for (let page = range.from; page <= range.to; page++) {
      const text = byPdfPage.get(page + offset)
      if (text?.trim()) own.push({ page, text })
    }
    for (const c of chunkPages(own))
      out.push({ unitId, page: c.page, position: c.position, content: c.content })
  }
  return out
}

/** Units of `units` the text covers, and how many book pages were read. */
export function coverage(chunks: readonly UnitChunk[]): { units: number; pages: number } {
  return {
    units: new Set(chunks.map((c) => c.unitId)).size,
    pages: new Set(chunks.map((c) => c.page)).size,
  }
}

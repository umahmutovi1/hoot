import type { AiOutlineUnit } from './ai'
import { MAX_DEPTH } from './parse'

/**
 * Materials from a PDF (PRD "Materijali", Stage 10c), pure. The PDF's outline (bookmarks) becomes
 * units with pages for the same review as `parse-toc`, without an AI call; without an outline the
 * table-of-contents pages are found so only their text goes to the model.
 */

export interface PdfOutlineItem {
  title: string
  /** 0 = top level. */
  depth: number
  /** 1-based page in the PDF, null when the bookmark has no page. */
  page: number | null
}

/** Front matter bookmarks that are not material. */
const SKIP = /^(?:contents|table of contents|sadržaj|sadrzaj|садржај|index|indeks|kazalo)$/i
/** "2.1 Konvolucija", "Chapter 3: Fourier", "Poglavlje 4 - Signali". */
const NUMBERED =
  /^(?:(?:chapter|poglavlje|lecture|predavanje|part|dio)\s+)?(\d+(?:\.\d+)*)[.:)]?\s*[-–—:]?\s+(.+)$/i

/**
 * Bookmarks → units: numbered titles keep their number as the label, the rest get labels by
 * position ("1", "1.1"); deeper levels are folded into the deepest supported one. Pages are PDF
 * pages minus `offset` (front matter before the book's page 1); the last unit ends on the last page.
 */
export function pdfOutlineUnits(
  items: PdfOutlineItem[],
  pageCount: number,
  offset = 0,
): AiOutlineUnit[] {
  const kept = items.filter((i) => i.title.trim() && !SKIP.test(i.title.trim()))
  const counters: number[] = []
  const out: AiOutlineUnit[] = []
  for (const item of kept) {
    const depth = Math.min(item.depth, MAX_DEPTH)
    counters.length = depth + 1
    counters[depth] = (counters[depth] ?? 0) + 1
    for (let d = 0; d < depth; d++) counters[d] = counters[d] ?? 1
    const title = item.title.replace(/\s+/g, ' ').trim()
    const numbered = NUMBERED.exec(title)
    const label =
      numbered && numbered[1]!.split('.').length === depth + 1
        ? numbered[1]!
        : counters.slice(0, depth + 1).join('.')
    const page = item.page === null ? null : Math.max(1, item.page - offset)
    out.push({
      label,
      title: numbered && numbered[1] === label ? numbered[2]!.trim() : title,
      page_start: page,
      page_end: null,
      ai_difficulty: null,
      topics: [],
    })
  }
  // The last unit and the units it sits in end on the last page (nothing after them to end on).
  const end = pageCount - offset
  let depth = Infinity
  for (let i = out.length - 1; i >= 0 && depth > 0; i--) {
    const d = out[i]!.label.split('.').length - 1
    if (d >= depth) continue
    depth = d
    const u = out[i]!
    if (u.page_start != null) u.page_end = Math.max(u.page_start, end)
  }
  return out
}

/**
 * Offset from PDF page labels: the index of the page labelled "1" (roman front matter before it).
 * 0 when the PDF has no labels or none is "1".
 */
export function offsetFromLabels(labels: string[] | null): number {
  if (!labels) return 0
  const i = labels.findIndex((l) => l.trim() === '1')
  return i > 0 ? i : 0
}

/** How many pages at the start may hold the table of contents. */
const TOC_SEARCH_PAGES = 20
const TOC_TITLE = /(?:^|\n)\s*(?:sadržaj|sadrzaj|contents|table of contents|садржај)\s*(?:\n|$)/i
/** A line that ends with a page number: "2.1 Konvolucija .... 75". */
const TOC_LINE = /\S.*?[\s.·…]\d{1,4}\s*$/

/**
 * Pages of the table of contents (1-based, inclusive): the first page in the first 20 titled
 * "Sadržaj" / "Contents", and the pages right after it that still read like one (a third of the
 * lines end with a page number). Null when there is none.
 */
export function findTocPages(
  pages: { page: number; text: string }[],
): { from: number; to: number } | null {
  const first = pages.slice(0, TOC_SEARCH_PAGES)
  const start = first.find((p) => TOC_TITLE.test(p.text))
  if (!start) return null
  let to = start.page
  for (const p of pages.filter((x) => x.page > start.page)) {
    if (p.page !== to + 1 || !looksLikeToc(p.text)) break
    to = p.page
  }
  return { from: start.page, to }
}

function looksLikeToc(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length < 4) return false
  return lines.filter((l) => TOC_LINE.test(l)).length / lines.length >= 1 / 3
}

/** Several PDFs as one source (e.g. lectures from Drive): one unit per file, by name. */
export function filesAsUnits(
  files: { name: string; pages: number }[],
  prefix = 'L',
): AiOutlineUnit[] {
  let start = 1
  return [...files]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((f, i) => {
      const unit: AiOutlineUnit = {
        label: `${prefix}${i + 1}`,
        title: f.name
          .replace(/\.pdf$/i, '')
          .replace(/[_]+/g, ' ')
          .trim(),
        page_start: start,
        page_end: start + Math.max(1, f.pages) - 1,
        ai_difficulty: null,
        topics: [],
      }
      start = unit.page_end! + 1
      return unit
    })
}

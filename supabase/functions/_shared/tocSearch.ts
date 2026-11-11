// "Izvor bez PDF-a: sadržaj s interneta" (PRD, Sprint 19), pure: the web search prompt for a
// book's table of contents and which answer to keep. Only what the user typed (title, author,
// edition) goes into the search. Tested with Vitest like the other _shared code.
import { searchedSite } from './academicSearch.ts'
import type { LlmRequest, WebSource } from './llm.ts'
import { findTocOutputSchema } from './schemas.ts'
import type { FindTocOutput, FindTocRequest, FoundToc, WebTocUnit } from './schemas.ts'

const LANGUAGE = { bs: 'Bosnian', en: 'English' } as const
export const MAX_TOC_SEARCHES = 4
/** Fewer chapters than this is a blurb or a review, not a table of contents. */
export const MIN_TOC_UNITS = 2

/** Bumped when the prompt changes, so a search saved with the old prompt runs again. */
const PROMPT_VERSION = 1

/** Same title, author and edition = same search (one call per title). */
export function tocSearchKey(req: FindTocRequest): string {
  const norm = req.query
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.,;:()"'“”„]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `v${PROMPT_VERSION}|${norm}`
}

export function tocSearchRequest(req: FindTocRequest): LlmRequest<FindTocOutput> {
  const system = `You help a student who has a book but no PDF of it. Search the web for the
book's table of contents (chapters with their page numbers) and return it.
Look on the publisher's site, library catalogues (WorldCat, national and university libraries,
COBISS, Library of Congress), Google Books and bookshops; "table of contents", "sadržaj" and
"contents pdf" in the query help.
Rules:
- Copy the chapters exactly as listed on one page you found, in order. Never invent chapters,
  numbers or pages, and never fill gaps from memory: an empty list is better than a guess.
- label: the chapter number as listed ("4", "4.1"); at most two levels. Without numbers, number
  the chapters "1", "2", … by position. Skip front and back matter (preface, index, appendices
  of tables, bibliography).
- page_start: the page listed next to the chapter, null when the page does not list pages.
  page_end only when a range is listed, else null. Never compute pages.
- source_url: that page's full https URL, exactly as found in the search results; never build a
  URL. source_title: its title as shown. site_kind: publisher, library (catalogue), store
  (bookshop, Google Books) or other.
- edition: the edition number of the contents you copied, null when the page does not say.
  When the user names an edition, prefer contents of that edition.
- No contents found (only a description or reviews): units empty, source_url null.`
  return {
    task: 'find_toc',
    system,
    text: [
      `Book (title, author, edition as typed): ${req.query}`,
      `User language: ${LANGUAGE[req.locale]}`,
    ].join('\n'),
    schema: findTocOutputSchema,
    maxTokens: 6000,
    webSearch: { maxUses: MAX_TOC_SEARCHES },
  }
}

/**
 * The contents to show, or null: the page must be on a site the search returned (otherwise the
 * link, and so the chapters, were made up) and list at least two chapters. Labels are unique,
 * an end page before its start page is dropped.
 */
export function keepToc(data: FindTocOutput, sources: WebSource[]): FoundToc | null {
  const url = data.source_url?.trim() ?? ''
  if (!url || !searchedSite(sources)(url)) return null
  const seen = new Set<string>()
  const units: WebTocUnit[] = data.units.flatMap((u) => {
    const label = u.label.trim().replace(/\.$/, '')
    const title = u.title.replace(/\s+/g, ' ').trim()
    if (!label || !title || seen.has(label)) return []
    seen.add(label)
    const page_end =
      u.page_start !== null && u.page_end !== null && u.page_end < u.page_start ? null : u.page_end
    return [{ label, title, page_start: u.page_start, page_end }]
  })
  if (units.length < MIN_TOC_UNITS) return null
  return {
    units,
    source_url: url,
    source_title: data.source_title?.trim() || null,
    site_kind: data.site_kind,
    edition: data.edition,
  }
}

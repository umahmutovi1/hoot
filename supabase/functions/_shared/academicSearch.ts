// "Fakultet s interneta" (PRD, Stage 10c), pure: the web search prompt, which found links to
// keep, and HTML pages as text for parse-document. Tested with Vitest like the other _shared code.
import type { LlmRequest, WebSource } from './llm.ts'
import { findAcademicInfoOutputSchema } from './schemas.ts'
import type { FindAcademicInfoRequest, FoundDocument, PageText } from './schemas.ts'

type SearchRequest = Extract<FindAcademicInfoRequest, { op: 'search' }>

const LANGUAGE = { bs: 'Bosnian', en: 'English' } as const
/** Searches the model may run for one request. */
export const MAX_SEARCHES = 4
/** Links shown at most. */
export const MAX_FOUND = 6

/** Same faculty, programme, year and academic year = same search (one call per change). */
export function searchKey(req: SearchRequest): string {
  const norm = (s: string | null) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  return [
    norm(req.institution),
    norm(req.program),
    req.year_of_study ?? '',
    req.academic_year,
  ].join('|')
}

export function academicSearchRequest(
  req: SearchRequest,
): LlmRequest<{ documents: FoundDocument[] }> {
  const system = `You help a university student find official documents of their faculty on the web.
Search the web and return links to the faculty's own documents for the given academic year:
- academic_calendar: the academic calendar (teaching periods, exam sessions, holidays).
- syllabus: the study programme / course syllabi ("nastavni plan i program", "silabus") for
  the given programme and year of study.
Rules:
- Only links you actually found in the search results, copied exactly (full https URL).
  Never guess or build a URL. Prefer the faculty's or university's own site, and PDF files.
- academic_year: the year the document says it is for ("2026/27"), null if it does not say.
- Titles as shown on the page, in the document's language. At most ${MAX_FOUND} links;
  an empty list when nothing official is found.`
  const lines = [
    `Faculty: ${req.institution}`,
    `Study programme: ${req.program ?? 'not given'}`,
    `Year of study: ${req.year_of_study ?? 'not given'}`,
    `Academic year: ${req.academic_year}`,
    `User language: ${LANGUAGE[req.locale]}`,
  ]
  return {
    task: 'find_academic_info',
    system,
    text: lines.join('\n'),
    schema: findAcademicInfoOutputSchema,
    maxTokens: 2000,
    webSearch: { maxUses: MAX_SEARCHES },
  }
}

/** Gemini's grounding links are redirects through this host; their titles carry the domain. */
const REDIRECT_HOST = 'vertexaisearch.cloud.google.com'

const hostOf = (url: string): string | null => {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' ? u.hostname.toLowerCase().replace(/^www\./, '') : null
  } catch {
    return null
  }
}

/** A public https host (no IP address, localhost or single-label name). */
export function isPublicHttps(url: string): boolean {
  const host = hostOf(url)
  if (!host || !host.includes('.')) return false
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return false
  return !/(^|\.)localhost$|\.local$|\.internal$/.test(host)
}

/**
 * Found links worth checking: public https, one per URL, and from a site the search really
 * returned (a link on another site was made up). Without any source to compare (a provider that
 * returned none) the reachability check alone decides.
 */
export function keepFound(docs: FoundDocument[], sources: WebSource[]): FoundDocument[] {
  const allowed = new Set<string>()
  for (const s of sources) {
    const host = hostOf(s.url)
    if (host && host !== REDIRECT_HOST) allowed.add(host)
    else if (s.title && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s.title))
      allowed.add(s.title.toLowerCase().replace(/^www\./, ''))
  }
  const sameSite = (host: string) =>
    allowed.size === 0 ||
    [...allowed].some((a) => host === a || host.endsWith(`.${a}`) || a.endsWith(`.${host}`))
  const seen = new Set<string>()
  const out: FoundDocument[] = []
  for (const d of docs) {
    const url = d.url.trim()
    const host = hostOf(url)
    if (!host || !isPublicHttps(url) || seen.has(url) || !sameSite(host)) continue
    seen.add(url)
    out.push({ ...d, url, title: d.title.trim() })
    if (out.length >= MAX_FOUND) break
  }
  return out
}

/** "2026/27" also when the model wrote "2026/2027" or "2026-27". */
export function normalizeYear(year: string | null): string | null {
  if (!year) return null
  const m = /(\d{4})\s*[/-]\s*(\d{2,4})/.exec(year)
  if (!m) return null
  return `${m[1]}/${m[2]!.slice(-2)}`
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** Visible text of an HTML page, in pages of about 3000 characters for parse-document. */
export function htmlToPages(html: string, maxChars = 60_000): PageText[] {
  const text = html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/table)\b[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#')
        return String.fromCodePoint(
          e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10),
        )
      return ENTITIES[e.toLowerCase()] ?? m
    })
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxChars)
  const pages: PageText[] = []
  let rest = text
  while (rest.length > 0) {
    let cut = rest.length <= 3000 ? rest.length : rest.lastIndexOf('\n', 3000)
    if (cut < 1000) cut = Math.min(rest.length, 3000)
    pages.push({ page: pages.length + 1, text: rest.slice(0, cut).trim() })
    rest = rest.slice(cut)
  }
  return pages.filter((p) => p.text)
}

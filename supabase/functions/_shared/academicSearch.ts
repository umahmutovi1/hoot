// "Fakultet s interneta" (PRD, Stage 10c), pure: the web search prompt, which found links to
// keep, and HTML pages as text for parse-document. Tested with Vitest like the other _shared code.
import type { LlmRequest, WebSource } from './llm.ts'
import { findAcademicInfoOutputSchema } from './schemas.ts'
import type { FindAcademicInfoRequest, FoundDocument, PageText } from './schemas.ts'

type SearchRequest = Extract<FindAcademicInfoRequest, { op: 'search' }>

const LANGUAGE = { bs: 'Bosnian', en: 'English' } as const
/** Searches the model may run for one request (the calendar and the syllabus each need a few). */
export const MAX_SEARCHES = 6
/** Links shown at most. */
export const MAX_FOUND = 6

/** Bumped when the prompt changes, so a search saved with the old prompt runs again. */
const PROMPT_VERSION = 2

/** Same faculty, programme, year and academic year = same search (one call per change). */
export function searchKey(req: SearchRequest): string {
  const norm = (s: string | null) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  return [
    `v${PROMPT_VERSION}`,
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
Search the web and return links to the faculty's own documents of two kinds:
- academic_calendar: the academic calendar (teaching periods, exam sessions, holidays) for the
  given academic year.
- syllabus: the study plan and programme ("nastavni plan i program", "NPP", "plan studija",
  "silabus", "syllabus") of the given programme, or the course syllabi of its year of study.
  A study plan is often valid for several years and may not name the current academic year:
  return the newest one in force even when it is from an earlier year.
Search for each kind separately: first the calendar, then the study plan (also on the faculty's
pages for students, study programmes and departments, and with "pdf" in the query).
Rules:
- Only links you actually found in the search results, copied exactly (full https URL).
  Never guess or build a URL. Prefer the faculty's or university's own site, and PDF files.
- academic_year: the year the document says it is for ("2026/27"), null if it does not say.
- Titles as shown on the page, in the document's language. At most ${MAX_FOUND} links, with
  the study plan included whenever one is found; an empty list when nothing official is found.`
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

const hostOf = (url: string, schemes = ['https:']): string | null => {
  try {
    const u = new URL(url)
    return schemes.includes(u.protocol) ? u.hostname.toLowerCase().replace(/^www\./, '') : null
  } catch {
    return null
  }
}

const isPublicHost = (host: string | null): boolean => {
  if (!host || !host.includes('.')) return false
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || host.startsWith('[')) return false
  return !/(^|\.)localhost$|\.local$|\.internal$/.test(host)
}

/** A public https host (no IP address, localhost or single-label name). */
export const isPublicHttps = (url: string): boolean => isPublicHost(hostOf(url))

/** A link the user pasted: a public host over https or http (many faculty sites are http only). */
export const isPublicLink = (url: string): boolean => isPublicHost(hostOf(url, ['https:', 'http:']))

/** A title for a pasted link: the file name without its extension, else the host. */
export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '')
    const name = last
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim()
    // Hash-like names ("d0937793ed9b…") say nothing; the host does.
    return name && !/^[0-9a-f]{16,}$/i.test(name) ? name.slice(0, 120) : u.hostname
  } catch {
    return url.slice(0, 120)
  }
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

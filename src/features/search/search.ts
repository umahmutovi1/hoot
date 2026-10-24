import Fuse from 'fuse.js'

// Search (PRD "Navigacija, pretraga, teme i geste", Stage 10b): screens, settings and actions with
// synonyms, plus subjects, exams, sources, units and documents from the query cache. Runs on the
// device with fuse.js, offline, without AI.

export const SEARCH_GROUPS = [
  'actions',
  'screens',
  'settings',
  'subjects',
  'exams',
  'sources',
  'units',
  'documents',
] as const
export type SearchGroup = (typeof SEARCH_GROUPS)[number]

export interface SearchEntry {
  id: string
  group: SearchGroup
  title: string
  sub?: string
  /** Synonyms and other words that should find it ("više vremena", "pauze", "boja"). */
  keywords: string[]
  /** Route to open; actions add a query (`?more=1`) the screen turns into a sheet. */
  to: string
  /** Subject color for the dot (data entries). */
  color?: string | null
}

export interface SearchHit {
  entry: SearchEntry
  /** Matched [start, end] ranges in the title (inclusive), for bold text. */
  ranges: [number, number][]
}

export interface SearchGroupHits {
  group: SearchGroup
  hits: SearchHit[]
}

export function createSearcher(entries: SearchEntry[]) {
  const fuse = new Fuse(entries, {
    keys: [
      { name: 'title', weight: 0.65 },
      { name: 'keywords', weight: 0.3 },
      { name: 'sub', weight: 0.05 },
    ],
    threshold: 0.34,
    ignoreLocation: true,
    ignoreDiacritics: true,
    includeMatches: true,
    minMatchCharLength: 2,
  })
  return (query: string): SearchGroupHits[] => {
    const q = query.trim()
    if (q.length < 2) return []
    const byGroup = new Map<SearchGroup, SearchHit[]>()
    for (const r of fuse.search(q)) {
      const ranges = (r.matches ?? [])
        .filter((m) => m.key === 'title')
        .flatMap((m) => m.indices.filter(([a, b]) => b - a >= 1).map(([a, b]) => [a, b]))
      const list = byGroup.get(r.item.group) ?? []
      list.push({ entry: r.item, ranges: ranges as [number, number][] })
      byGroup.set(r.item.group, list)
    }
    return SEARCH_GROUPS.filter((g) => byGroup.has(g)).map((g) => ({
      group: g,
      hits: byGroup.get(g)!,
    }))
  }
}

/** Title split into plain and matched parts (for <b>). */
export function highlight(title: string, ranges: [number, number][]) {
  const parts: { text: string; match: boolean }[] = []
  let at = 0
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
    if (a < at) continue
    if (a > at) parts.push({ text: title.slice(at, a), match: false })
    parts.push({ text: title.slice(a, b + 1), match: true })
    at = b + 1
  }
  if (at < title.length) parts.push({ text: title.slice(at), match: false })
  return parts
}

const RECENT_MAX = 6

/** Recent queries, newest first, without duplicates (case-insensitive). */
export function addRecent(list: string[], query: string): string[] {
  const q = query.trim()
  if (!q) return list
  return [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX)
}

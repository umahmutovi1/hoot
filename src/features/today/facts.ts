/**
 * "Znaš li?" study facts on Today. Every fact was checked against its source (paper, or the
 * interview / page the number comes from); the text lives in the locale files under
 * `facts.<id>`. Source labels are author names and years, so they are not translated.
 */
export interface StudyFact {
  id: FactId
  source: string
  url: string
}

export const FACTS = [
  {
    id: 'testingWeek',
    source: 'Roediger & Karpicke, 2006',
    url: 'https://doi.org/10.1111/j.1467-9280.2006.01693.x',
  },
  {
    id: 'rereadConfidence',
    source: 'Roediger & Karpicke, 2006',
    url: 'https://doi.org/10.1111/j.1467-9280.2006.01693.x',
  },
  {
    id: 'retrievalConceptMaps',
    source: 'Karpicke & Blunt, 2011',
    url: 'https://doi.org/10.1126/science.1199327',
  },
  {
    id: 'interleaving',
    source: 'Rohrer & Taylor, 2007',
    url: 'https://doi.org/10.1007/s11251-007-9015-8',
  },
  {
    id: 'spacingSessions',
    source: 'Rohrer & Taylor, 2007',
    url: 'https://doi.org/10.1007/s11251-007-9015-8',
  },
  {
    id: 'spacingGap',
    source: 'Cepeda et al., 2008',
    url: 'https://doi.org/10.1111/j.1467-9280.2008.02209.x',
  },
  {
    id: 'techniquesRanking',
    source: 'Dunlosky et al., 2013',
    url: 'https://doi.org/10.1177/1529100612453266',
  },
  {
    id: 'studentsReread',
    source: 'Karpicke, Butler & Roediger, 2009',
    url: 'https://doi.org/10.1080/09658210802647009',
  },
  {
    id: 'multitasking',
    source: 'APA · Meyer',
    url: 'https://www.apa.org/topics/research/multitasking',
  },
  {
    id: 'interruption',
    source: 'Gloria Mark · Gallup, 2006',
    url: 'https://news.gallup.com/businessjournal/23146/too-many-interruptions-work.aspx',
  },
  {
    id: 'taskSwitching',
    source: 'González & Mark, 2004',
    url: 'https://www.ics.uci.edu/~gmark/CHI2004.pdf',
  },
  {
    id: 'mindWandering',
    source: 'Killingsworth & Gilbert, 2010',
    url: 'https://doi.org/10.1126/science.1192439',
  },
  {
    id: 'notifications',
    source: 'Stothart et al., 2015',
    url: 'https://doi.org/10.1037/xhp0000100',
  },
  {
    id: 'mediaMultitaskers',
    source: 'Ophir, Nass & Wagner, 2009',
    url: 'https://doi.org/10.1073/pnas.0903620106',
  },
  {
    id: 'writeWorries',
    source: 'Ramirez & Beilock, 2011',
    url: 'https://doi.org/10.1126/science.1199427',
  },
  {
    id: 'hypercorrection',
    source: 'Butterfield & Metcalfe, 2001',
    url: 'https://doi.org/10.1037/0278-7393.27.6.1491',
  },
  {
    id: 'expectTeach',
    source: 'Nestojko et al., 2014',
    url: 'https://doi.org/10.3758/s13421-014-0416-z',
  },
  {
    id: 'greenBreak',
    source: 'Lee et al., 2015',
    url: 'https://doi.org/10.1016/j.jenvp.2015.04.003',
  },
  {
    id: 'sleepAfter',
    source: 'Gais, Lucas & Born, 2006',
    url: 'https://doi.org/10.1101/lm.132106',
  },
  {
    id: 'wakefulRest',
    source: 'Dewar et al., 2012',
    url: 'https://doi.org/10.1177/0956797612441220',
  },
] as const satisfies readonly { id: string; source: string; url: string }[]

export type FactId = (typeof FACTS)[number]['id']

/** Whole days since 1970-01-01 for a local `yyyy-MM-dd` date. */
function dayNumber(localDate: string): number {
  const [y = 1970, m = 1, d = 1] = localDate.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * The same fact all day, a different one the next day; every fact comes up once before any
 * repeats. Steps by a stride coprime with the list length so related facts are not adjacent.
 */
export function factOfDay(localDate: string, facts: readonly StudyFact[] = FACTS): StudyFact {
  const n = facts.length
  const stride = [7, 11, 13, 3, 1].find((s) => gcd(s, n) === 1) ?? 1
  const i = (((dayNumber(localDate) * stride) % n) + n) % n
  return facts[i]!
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

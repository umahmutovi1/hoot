/**
 * "One line per unit" outline parser. Manual entry uses it now; AI import (Stage 8) produces the
 * same `OutlineUnit` shape, so review, merge and saving are shared.
 *
 * Line format: `<label> <title> <pages>`, e.g. `2.1 Konvolucija 75` or `4 Fourierova 284-355`.
 * - The label is optional (`1`, `2.1`, `P12`, `L1–3`, `Poglavlje 3:`); dots in a numeric label
 *   make sub-units (`2.1` under `2`), at most three levels deep (PRD: fixed depth, deeper flattens).
 * - Pages: a single number is the start page and the end is the next unit's start − 1; `a-b` is
 *   an explicit range. Slides: `a-b` is a range, a single number is the slide count.
 * - Questions and items: the whole rest of the line is the title, one line = one unit.
 */

export const MEASURES = ['pages', 'slides', 'questions', 'items'] as const
export type Measure = (typeof MEASURES)[number]

export const MAX_DEPTH = 2

export interface OutlineUnit {
  label: string
  title: string
  /** Label of the parent unit, null for top-level units. */
  parentLabel: string | null
  /** 0 = top level, at most MAX_DEPTH. */
  depth: number
  pageStart: number | null
  pageEnd: number | null
  /** Pages, slides or 1 (questions, items). */
  amount: number
  /** True when the amount could not be read and is the average of the other units. */
  amountGuessed: boolean
  /** Prior difficulty 1–5 (AI, or set by the user in review); null = not set (counts as 3). */
  difficulty: number | null
}

export type OutlineWarningCode = 'missingAmount' | 'pageOrder' | 'duplicateLabel'

export interface OutlineWarning {
  code: OutlineWarningCode
  /** Labels as written by the user (after renaming duplicates, the new label). */
  labels: string[]
}

export interface ParsedOutline {
  units: OutlineUnit[]
  warnings: OutlineWarning[]
}

const LABEL_WORDS = '(?:poglavlje|pogl\\.?|chapter|ch\\.|lekcija|lesson|pitanje|question)'
const LABEL = new RegExp(
  `^(?:${LABEL_WORDS}\\s*)?((?:\\p{L}{1,3}\\d+(?:\\s*[–-]\\s*\\d+)?)|(?:\\d+(?:\\.\\d+)*))[.):]?\\s+(.+)$`,
  'iu',
)
const TRAILING_PAGES =
  /^(.*?\S)[\s.·…_:,]+(?:(?:str|pp?|pages?)\.?\s*)?(\d+)(?:\s*[-–—]\s*(\d+))?$/iu
const BULLET = /^[-•*–]\s+/

interface Line {
  label: string | null
  title: string
  start: number | null
  end: number | null
  /** Single number on a slides line = slide count. */
  count: number | null
}

function readLine(raw: string, measure: Measure): Line | null {
  const text = raw.replace(BULLET, '').trim()
  if (!text) return null
  const labelled = LABEL.exec(text)
  let label = labelled ? labelled[1]!.replace(/\s+/g, '') : null
  let rest = labelled ? labelled[2]!.trim() : text
  if (label && measure === 'questions' && /^\d+$/.test(label)) label = `P${label}`

  if (measure === 'questions' || measure === 'items') {
    return { label, title: cleanTitle(rest), start: null, end: null, count: null }
  }
  const pages = TRAILING_PAGES.exec(rest)
  if (!pages) return { label, title: cleanTitle(rest), start: null, end: null, count: null }
  rest = pages[1]!
  const a = Number(pages[2])
  const b = pages[3] === undefined ? null : Number(pages[3])
  if (measure === 'slides' && b === null) {
    return { label, title: cleanTitle(rest), start: null, end: null, count: a }
  }
  return { label, title: cleanTitle(rest), start: a, end: b, count: null }
}

function cleanTitle(title: string) {
  return title.replace(/[\s.·…_:,]+$/u, '').trim()
}

/** Parent label candidates: `2.1.3` → `2.1`, `2`. */
function ancestorsOf(label: string): string[] {
  if (!/^\d+(\.\d+)+$/.test(label)) return []
  const parts = label.split('.')
  return parts.slice(1).map((_, i) => parts.slice(0, parts.length - 1 - i).join('.'))
}

export function parseOutline(text: string, measure: Measure): ParsedOutline {
  const lines = text
    .split(/\r?\n/)
    .map((l) => readLine(l, measure))
    .filter((l): l is Line => l !== null)

  const units: (OutlineUnit & { explicitEnd: boolean; count: number | null })[] = []
  const byLabel = new Map<string, (typeof units)[number]>()
  const duplicates: string[] = []
  let topLevel = 0

  for (const line of lines) {
    let label = line.label ?? autoLabel(measure, topLevel + 1)
    if (byLabel.has(label)) {
      let n = 2
      while (byLabel.has(`${label}-${n}`)) n++
      label = `${label}-${n}`
      duplicates.push(label)
    }

    let parent = line.label
      ? ancestorsOf(line.label)
          .map((l) => byLabel.get(l))
          .find(Boolean)
      : undefined
    while (parent && parent.depth >= MAX_DEPTH) {
      parent = parent.parentLabel ? byLabel.get(parent.parentLabel) : undefined
    }
    const depth = parent ? parent.depth + 1 : 0
    if (depth === 0) topLevel++

    const unit = {
      label,
      title: line.title || label,
      parentLabel: parent?.label ?? null,
      depth,
      pageStart: line.start,
      pageEnd: line.end,
      amount: 1,
      amountGuessed: false,
      difficulty: null,
      explicitEnd: line.end !== null,
      count: line.count,
    }
    units.push(unit)
    byLabel.set(label, unit)
  }

  const hasChildren = new Set(units.map((u) => u.parentLabel).filter(Boolean))
  const pageOrder: string[] = []
  const missing: string[] = []

  units.forEach((u, i) => {
    if (measure === 'questions' || measure === 'items') return
    if (u.count !== null) {
      u.amount = u.count
      return
    }
    if (u.pageStart !== null && u.pageEnd === null && measure === 'pages') {
      const next = units.slice(i + 1).find((n) => n.depth <= u.depth && n.pageStart !== null)
      if (next) u.pageEnd = Math.max(u.pageStart, next.pageStart! - 1)
    }
    const reversed = u.pageStart !== null && u.pageEnd !== null && u.pageEnd < u.pageStart
    if (reversed) {
      pageOrder.push(u.label)
      u.pageEnd = null
    }
    if (u.pageStart !== null && u.pageEnd !== null) {
      u.amount = u.pageEnd - u.pageStart + 1
    } else {
      u.amountGuessed = true
      if (!reversed && !hasChildren.has(u.label)) missing.push(u.label)
    }
  })

  // Unknown amounts get the average of the known leaves, so they still weigh something.
  const known = units.filter((u) => !u.amountGuessed && !hasChildren.has(u.label))
  const average = known.length
    ? Math.max(1, Math.round(known.reduce((s, u) => s + u.amount, 0) / known.length))
    : 1
  for (const u of units) if (u.amountGuessed) u.amount = average

  const warnings: OutlineWarning[] = []
  if (missing.length) warnings.push({ code: 'missingAmount', labels: missing })
  if (pageOrder.length) warnings.push({ code: 'pageOrder', labels: pageOrder })
  if (duplicates.length) warnings.push({ code: 'duplicateLabel', labels: duplicates })

  return {
    units: units.map(({ explicitEnd: _e, count: _c, ...u }) => u),
    warnings,
  }
}

function autoLabel(measure: Measure, n: number) {
  return measure === 'questions' ? `P${n}` : String(n)
}

export interface FormattableUnit {
  label: string | null
  title: string
  pageStart: number | null
  pageEnd: number | null
  amount: number
}

/** Writes units back as lines that parse to the same outline (explicit ranges, explicit labels). */
export function formatOutline(units: FormattableUnit[], measure: Measure): string {
  return units
    .map((u) => {
      const head = [u.label, u.title].filter(Boolean).join(' ')
      if (measure === 'questions' || measure === 'items') return head
      if (u.pageStart !== null && u.pageEnd !== null) return `${head} ${u.pageStart}-${u.pageEnd}`
      if (measure === 'slides') return `${head} ${u.amount}`
      if (u.pageStart !== null) return `${head} ${u.pageStart}`
      return head
    })
    .join('\n')
}

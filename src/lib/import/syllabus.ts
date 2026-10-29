// Syllabus ("Plan i program", PRD "AI uvoz", Stage 10c) → a reviewable proposal per subject:
// literature → sources (offered, never preselected), topics or content chapters → topics and a
// temporary "Predavanja" source with hour-long parts per chapter, grading → exams and points.
// Elective options wait for the user's pick. Existing values the user entered are never
// overwritten (they show as "ostaje"). Nothing is written here.
import Fuse from 'fuse.js'
import { matchSubject, type ExamKind, type ImportSubject, type ProposalStatus } from '.'
import { ROUGH_HOURS, ROUGH_PART_MINUTES } from '@/lib/estimates/rough'

export type GradingKind =
  'partial' | 'final' | 'integral' | 'makeup' | 'attendance' | 'assignment' | 'seminar' | 'other'

export interface ParsedSyllabus {
  subject_name: string
  subject_id: string | null
  semester: number | null
  /** The elective slot this subject is an option of ("Izborni predmet 4.1"); null = required. */
  elective_group?: string | null
  literature: { title: string; authors: string | null; required: boolean }[]
  topics: { week: number | null; name: string }[]
  grading: {
    kind: GradingKind
    number: number | null
    title: string
    points: number | null
    pass_points: number | null
  }[]
}

export interface SyllabusExisting {
  /** Active sources; `rough` = a temporary source (rough size or earlier syllabus chapters). */
  sources: { subjectId: string; title: string; rough?: boolean }[]
  topics: { subjectId: string; name: string }[]
  exams: {
    id: string
    subjectId: string
    kind: ExamKind
    date: string
    pointsMax: number | null
    passMinPct: number | null
  }[]
  /** `subjects.points_total`; 100 is the untouched default. */
  pointsTotal: Record<string, number>
}

export interface LiteratureProposal {
  key: string
  title: string
  authors: string | null
  required: boolean
  status: ProposalStatus
  include: boolean
}

export interface TopicProposal {
  key: string
  week: number | null
  name: string
  status: ProposalStatus
  include: boolean
}

export interface GradingProposal {
  key: string
  kind: GradingKind
  number: number | null
  title: string
  points: number | null
  passPoints: number | null
  /** An exam the item updates; null = a new exam (or not an exam at all). */
  existingId: string | null
  previousPoints: number | null
  /** Points already entered by the user: they stay ("ručno"). */
  manual: boolean
  /** Point items that are not exams (attendance, homework, seminar) only count in the total. */
  examKind: ExamKind | null
  status: ProposalStatus
  include: boolean
}

/** One hour-long part of the "Predavanja" source: chapter `chapter` (0-based), part k of n. */
export interface ChapterPart {
  chapter: number
  name: string
  k: number
  n: number
}

/**
 * The content chapters as a temporary source until a real one comes (`sources.is_rough`): the
 * same hour-long parts as a rough size ("Srednje", ~25 h), spread over the chapters in order and
 * linked to their topics. Offered only while the subject has no real source; it replaces an
 * earlier rough source.
 */
export interface ChaptersProposal {
  parts: ChapterPart[]
  /** The subject already has a rough source this one replaces. */
  replacesRough: boolean
  include: boolean
}

export interface SyllabusProposal {
  key: string
  subjectName: string
  /** Matched subject; null = not ours yet. */
  subjectId: string | null
  /** For an unmatched subject: create it (default on). */
  addSubject: boolean
  /** Elective slot; its options are offered as one choice ("Koji slušaš?"). */
  electiveGroup: string | null
  semester: number | null
  literature: LiteratureProposal[]
  topics: TopicProposal[]
  chapters: ChaptersProposal | null
  grading: GradingProposal[]
  /** Sum of the points; written to the subject only when it still has the default 100. */
  pointsTotal: { value: number; previous: number | null; status: ProposalStatus } | null
  /** What was read, so "Upari sa…" can propose it again for another subject. */
  parsed: ParsedSyllabus
}

/** The untouched `subjects.points_total`. */
export const DEFAULT_POINTS_TOTAL = 100

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const EXAM_KINDS: Partial<Record<GradingKind, ExamKind>> = {
  partial: 'partial',
  final: 'final',
  integral: 'integral',
  makeup: 'makeup',
}

/**
 * A book the subject already has: a close title, and when the syllabus names authors, one of
 * their surnames in the existing title too (two books can share a title, "Signals and Systems").
 */
function similar(title: string, authors: string | null, titles: string[]): boolean {
  const target = norm(title)
  if (!target || titles.length === 0) return false
  const surnames = norm(authors ?? '')
    .split(' ')
    .filter((w) => w.length >= 4)
  const byAuthor = (t: string) => surnames.length === 0 || surnames.some((w) => norm(t).includes(w))
  const candidates = titles.filter(byAuthor)
  if (candidates.some((t) => norm(t).includes(target) || target.includes(norm(t)))) return true
  const fuse = new Fuse(candidates.map(norm), { threshold: 0.35, ignoreLocation: true })
  return fuse.search(target).length > 0
}

export function proposeSyllabus(
  parsed: readonly ParsedSyllabus[],
  subjects: readonly ImportSubject[],
  existing: SyllabusExisting,
): SyllabusProposal[] {
  return parsed.map((p, i) => {
    const subjectId = matchSubject(p, subjects)
    const key = `syl-${i}`
    const sourceTitles = existing.sources
      .filter((s) => s.subjectId === subjectId)
      .map((s) => s.title)
    const topicNames = new Set(
      existing.topics.filter((t) => t.subjectId === subjectId).map((t) => norm(t.name)),
    )

    const literature = p.literature.map((l, j): LiteratureProposal => {
      const have = subjectId !== null && similar(l.title, l.authors, sourceTitles)
      return {
        key: `${key}-lit-${j}`,
        title: l.title,
        authors: l.authors,
        required: l.required,
        status: have ? 'unchanged' : 'new',
        // Books are offered, never added by default: the user picks what becomes a source.
        include: false,
      }
    })

    const seenTopics = new Set<string>()
    const topics = p.topics.flatMap((t, j): TopicProposal[] => {
      const n = norm(t.name)
      if (!n || seenTopics.has(n)) return []
      seenTopics.add(n)
      const have = topicNames.has(n)
      return [
        {
          key: `${key}-top-${j}`,
          week: t.week,
          name: t.name.trim(),
          status: have ? 'unchanged' : 'new',
          include: !have,
        },
      ]
    })

    // Exams of the subject in date order, so "II parcijala" is the second partial.
    const exams = existing.exams
      .filter((e) => e.subjectId === subjectId)
      .sort((a, b) => a.date.localeCompare(b.date))
    const used = new Set<string>()
    const grading = p.grading.map((g, j): GradingProposal => {
      const examKind = EXAM_KINDS[g.kind] ?? null
      const base = {
        key: `${key}-grade-${j}`,
        kind: g.kind,
        number: g.number,
        title: g.title,
        points: g.points,
        passPoints: g.pass_points,
        examKind,
      }
      if (!examKind)
        return {
          ...base,
          existingId: null,
          previousPoints: null,
          manual: false,
          status: 'unchanged',
          include: false,
        }
      const sameKind = exams.filter((e) => e.kind === examKind && !used.has(e.id))
      const match =
        examKind === 'partial' && g.number !== null
          ? exams.filter((e) => e.kind === 'partial')[g.number - 1]
          : sameKind.length === 1
            ? sameKind[0]
            : undefined
      if (!match || used.has(match.id))
        return {
          ...base,
          existingId: null,
          previousPoints: null,
          manual: false,
          status: 'new',
          include: true,
        }
      used.add(match.id)
      const manual = match.pointsMax !== null && g.points !== null && match.pointsMax !== g.points
      const fills = match.pointsMax === null && g.points !== null
      return {
        ...base,
        existingId: match.id,
        previousPoints: match.pointsMax,
        manual,
        status: fills ? 'changed' : 'unchanged',
        include: fills,
      }
    })

    const sum = p.grading.reduce((s, g) => s + (g.points ?? 0), 0)
    const previous = subjectId ? (existing.pointsTotal[subjectId] ?? null) : null
    // The total is written only over the untouched default (a new subject has none yet).
    const totalStatus: ProposalStatus =
      previous === sum
        ? 'unchanged'
        : previous === null
          ? 'new'
          : previous === DEFAULT_POINTS_TOTAL
            ? 'changed'
            : 'unchanged'
    const pointsTotal = sum > 0 ? { value: sum, previous, status: totalStatus } : null

    const own = existing.sources.filter((s) => s.subjectId === subjectId)
    const hasReal = subjectId !== null && own.some((s) => !s.rough)
    const chapterNames = topics.map((x) => x.name)
    const chapters: ChaptersProposal | null =
      hasReal || chapterNames.length === 0
        ? null
        : {
            parts: chapterParts(chapterNames),
            replacesRough: own.some((s) => s.rough),
            include: true,
          }
    const electiveGroup = p.elective_group?.trim() || null

    return {
      key,
      subjectName: p.subject_name,
      subjectId,
      // An elective option is added only when picked.
      addSubject: subjectId === null && !electiveGroup,
      electiveGroup,
      semester: p.semester,
      literature,
      topics,
      chapters,
      grading,
      pointsTotal,
      parsed: p,
    }
  })
}

/**
 * Hour-long parts of a rough size ("Srednje") spread over the chapters in order: every chapter
 * gets at least one, the rest go one by one from the first chapter.
 */
export function chapterParts(names: readonly string[]): ChapterPart[] {
  if (names.length === 0) return []
  const total = Math.max(names.length, Math.round((ROUGH_HOURS.medium * 60) / ROUGH_PART_MINUTES))
  const base = Math.floor(total / names.length)
  const extra = total % names.length
  return names.flatMap((name, chapter) => {
    const n = base + (chapter < extra ? 1 : 0)
    return Array.from({ length: n }, (_, i) => ({ chapter, name, k: i + 1, n }))
  })
}

/**
 * "Koji slušaš?": the picked option of an elective slot is added, the other options of that slot
 * are not (an option already matched to one of the user's subjects stays as it is).
 */
export function pickElective(
  proposals: readonly SyllabusProposal[],
  key: string,
): SyllabusProposal[] {
  const picked = proposals.find((p) => p.key === key)
  if (!picked?.electiveGroup) return [...proposals]
  return proposals.map((p) =>
    p.electiveGroup !== picked.electiveGroup || p.subjectId
      ? p
      : { ...p, addSubject: p.key === key ? !picked.addSubject : false },
  )
}

/**
 * One syllabus read in parts (a long programme): the same subject from two parts (a page that
 * overlaps) is merged, keeping every topic, book and grading item once.
 */
export function mergeSyllabi<T extends ParsedSyllabus>(parts: readonly T[][]): T[] {
  const out = new Map<string, T>()
  const uniq = <T>(xs: T[], key: (x: T) => string) => {
    const seen = new Set<string>()
    return xs.filter((x) => {
      const k = key(x)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  for (const p of parts.flat()) {
    const k = norm(p.subject_name)
    const had = out.get(k)
    if (!had) {
      out.set(k, p)
      continue
    }
    out.set(k, {
      ...had,
      subject_id: had.subject_id ?? p.subject_id,
      semester: had.semester ?? p.semester,
      elective_group: had.elective_group ?? p.elective_group ?? null,
      literature: uniq([...had.literature, ...p.literature], (l) => norm(l.title)),
      topics: uniq([...had.topics, ...p.topics], (x) => norm(x.name)),
      grading: uniq(
        [...had.grading, ...p.grading],
        (g) => `${g.kind}|${g.number}|${norm(g.title)}`,
      ),
    })
  }
  return [...out.values()]
}

const SYLLABUS_MARKERS = [
  /nastavni plan/i,
  /plan i program/i,
  /\bsilabus|\bsyllabus/i,
  /sadržaj (modula|predmeta|kursa)|sadrzaj (modula|predmeta)/i,
  /ishodi (učenja|modula|predmeta)/i,
  /naziv (modula|predmeta)/i,
]

/**
 * A study plan or syllabus by its words, without an AI call: ECTS several times and at least two
 * syllabus headings ("Nastavni plan", "Sadržaj modula", "Ishodi učenja"…). "Pogodi sama" then
 * reads it as a syllabus right away.
 */
export function looksLikeSyllabus(pages: readonly { text: string }[]): boolean {
  const text = pages.map((p) => p.text).join('\n')
  const ects = text.match(/\bECTS\b/g)?.length ?? 0
  const headings = SYLLABUS_MARKERS.filter((m) => m.test(text)).length
  return ects >= 3 && headings >= 2
}

const YEAR_WORDS: Record<string, number> = {
  prva: 1,
  druga: 2,
  treca: 3,
  cetvrta: 4,
  peta: 5,
  sesta: 6,
}

/** The year of study a page starts describing ("Godina studija 2", "Godina: Druga godina"). */
function pageYear(text: string): number | null {
  const n = /godina studija\s*:?\s*(\d)\b|year of study\s*:?\s*(\d)\b/i.exec(text)
  if (n) return Number(n[1] ?? n[2])
  const w =
    /godina\s*:?\s*(prva|druga|treća|treca|četvrta|cetvrta|peta|šesta|sesta)\s+godina/i.exec(text)
  return w ? (YEAR_WORDS[norm(w[1]!)] ?? null) : null
}

/**
 * A whole programme's pages for one year of study, without an AI call: a page that names a year
 * starts that year's part, the pages after it belong to it until another year is named; pages
 * before any year (title, contents) stay. Unchanged when the document names fewer than two years.
 */
export function pagesForYear<T extends { text: string }>(pages: readonly T[], year: number): T[] {
  const years = pages.map((p) => pageYear(p.text))
  if (new Set(years.filter((y) => y !== null)).size < 2) return [...pages]
  let current: number | null = null
  return pages.filter((_, i) => {
    current = years[i] ?? current
    return current === null || current === year
  })
}

/** "Upari sa…": the same subject of the syllabus proposed again for one of ours. */
export function assignSyllabusSubject(
  proposal: SyllabusProposal,
  subject: ImportSubject,
  existing: SyllabusExisting,
): SyllabusProposal {
  const [again] = proposeSyllabus(
    [{ ...proposal.parsed, subject_id: subject.id }],
    [subject],
    existing,
  )
  return { ...again!, key: proposal.key }
}

/** How many rows "Spasi N" writes for the syllabus part (a new subject counts as one). */
export function syllabusSaveCount(proposals: readonly SyllabusProposal[]): number {
  return proposals.reduce((n, p) => {
    if (!p.subjectId && !p.addSubject) return n
    const pick = <T extends { include: boolean; status: ProposalStatus }>(xs: T[]) =>
      xs.filter((x) => x.include && (x.status === 'new' || x.status === 'changed')).length
    return (
      n +
      (p.subjectId ? 0 : 1) +
      pick(p.literature) +
      pick(p.topics) +
      (p.chapters?.include ? 1 : 0) +
      pick(p.grading.filter((g) => g.examKind)) +
      (p.pointsTotal && p.pointsTotal.status !== 'unchanged' ? 1 : 0)
    )
  }, 0)
}

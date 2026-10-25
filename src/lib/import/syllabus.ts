// Syllabus ("Plan i program", PRD "AI uvoz", Stage 10c) → a reviewable proposal per subject:
// literature → sources, weekly topics → topics, grading → exams and points. Existing values the
// user entered are never overwritten (they show as "ostaje"). Nothing is written here.
import Fuse from 'fuse.js'
import { matchSubject, type ExamKind, type ImportSubject, type ProposalStatus } from '.'

export type GradingKind =
  'partial' | 'final' | 'integral' | 'makeup' | 'attendance' | 'assignment' | 'seminar' | 'other'

export interface ParsedSyllabus {
  subject_name: string
  subject_id: string | null
  semester: number | null
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
  sources: { subjectId: string; title: string }[]
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

export interface SyllabusProposal {
  key: string
  subjectName: string
  /** Matched subject; null = not ours yet. */
  subjectId: string | null
  /** For an unmatched subject: create it (default on). */
  addSubject: boolean
  semester: number | null
  literature: LiteratureProposal[]
  topics: TopicProposal[]
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
        // Extra reading is offered, not added by default.
        include: !have && l.required,
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

    return {
      key,
      subjectName: p.subject_name,
      subjectId,
      addSubject: subjectId === null,
      semester: p.semester,
      literature,
      topics,
      grading,
      pointsTotal,
      parsed: p,
    }
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
      pick(p.grading.filter((g) => g.examKind)) +
      (p.pointsTotal && p.pointsTotal.status !== 'unchanged' ? 1 : 0)
    )
  }, 0)
}

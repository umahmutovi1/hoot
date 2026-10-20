// Turns what the owl read from a document into a reviewable proposal: every item is new,
// changed (an existing row gets new dates), unchanged or skipped. Nothing is written here.
import Fuse from 'fuse.js'

export type ProposalStatus = 'new' | 'changed' | 'unchanged' | 'skipped'

// ------------------------------------------------------------------ academic periods

export type PeriodKind = 'teaching' | 'exam' | 'holiday'
export type ExamSession = 'partial' | 'regular' | 'makeup'

export interface ParsedPeriod {
  kind: PeriodKind
  exam_session: ExamSession | null
  title: string
  starts_on: string
  ends_on: string
}

export interface ExistingPeriod extends ParsedPeriod {
  id: string
}

export interface PeriodProposal extends ParsedPeriod {
  key: string
  status: ProposalStatus
  include: boolean
  existingId: string | null
  previous: { starts_on: string; ends_on: string } | null
}

const overlaps = (a: ParsedPeriod, b: ParsedPeriod) =>
  a.starts_on <= b.ends_on && b.starts_on <= a.ends_on

/** A period matches an existing one of the same kind and session whose dates overlap. */
export function proposePeriods(
  parsed: readonly ParsedPeriod[],
  existing: readonly ExistingPeriod[],
): PeriodProposal[] {
  const used = new Set<string>()
  return parsed.map((p, i) => {
    const match = existing.find(
      (e) =>
        !used.has(e.id) &&
        e.kind === p.kind &&
        e.exam_session === p.exam_session &&
        (overlaps(e, p) || normalize(e.title) === normalize(p.title)),
    )
    if (match) used.add(match.id)
    const same = match && match.starts_on === p.starts_on && match.ends_on === p.ends_on
    const status: ProposalStatus = !match ? 'new' : same ? 'unchanged' : 'changed'
    return {
      ...p,
      key: `p${i}`,
      status,
      include: status !== 'unchanged',
      existingId: match?.id ?? null,
      previous: match && !same ? { starts_on: match.starts_on, ends_on: match.ends_on } : null,
    }
  })
}

// ------------------------------------------------------------------ exams

export type ExamKind = 'partial' | 'final' | 'integral' | 'makeup' | 'other'

export interface ParsedExam {
  subject_name: string
  subject_id: string | null
  kind: ExamKind
  number: number | null
  date: string
  time: string | null
}

export interface ImportSubject {
  id: string
  name: string
}

/** An existing exam with its date already in local terms. */
export interface ExistingExam {
  id: string
  subjectId: string
  kind: ExamKind
  date: string
  time: string
  dateLatest: string | null
  tentative: boolean
  passed: boolean
}

export interface ExamProposal extends ParsedExam {
  key: string
  status: ProposalStatus
  include: boolean
  /** Matched subject; null = "nemaš ovaj predmet" (skipped until one is picked). */
  subjectId: string | null
  existingId: string | null
  previous: { date: string; dateLatest: string | null; tentative: boolean } | null
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** The model's subject id when it is one of ours, else the closest name (fuse.js). */
export function matchSubject(
  exam: Pick<ParsedExam, 'subject_id' | 'subject_name'>,
  subjects: readonly ImportSubject[],
): string | null {
  if (exam.subject_id && subjects.some((s) => s.id === exam.subject_id)) return exam.subject_id
  const target = normalize(exam.subject_name)
  if (!target) return null
  const exact = subjects.find((s) => normalize(s.name) === target)
  if (exact) return exact.id
  const fuse = new Fuse(
    subjects.map((s) => ({ id: s.id, name: normalize(s.name) })),
    { keys: ['name'], threshold: 0.3, ignoreLocation: true, includeScore: true },
  )
  return fuse.search(target)[0]?.item.id ?? null
}

/**
 * The existing exam an imported one updates: the n-th partial for "II parcijala", else the
 * tentative exam whose range holds the date, else the only open exam of that kind.
 */
function findExisting(
  exam: ParsedExam,
  subjectId: string,
  existing: readonly ExistingExam[],
  used: ReadonlySet<string>,
): ExistingExam | undefined {
  const candidates = existing
    .filter((e) => e.subjectId === subjectId && e.kind === exam.kind && !used.has(e.id))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  if (exam.kind === 'partial' && exam.number !== null) {
    const all = existing
      .filter((e) => e.subjectId === subjectId && e.kind === 'partial')
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    const nth = all[exam.number - 1]
    if (nth && !used.has(nth.id)) return nth
  }
  const inRange = candidates.find(
    (e) => e.tentative && e.date <= exam.date && exam.date <= (e.dateLatest ?? e.date),
  )
  if (inRange) return inRange
  const open = candidates.filter((e) => !e.passed)
  return open.length === 1 ? open[0] : undefined
}

export function proposeExams(
  parsed: readonly ParsedExam[],
  subjects: readonly ImportSubject[],
  existing: readonly ExistingExam[],
): ExamProposal[] {
  const used = new Set<string>()
  return parsed.map((exam, i) => {
    const subjectId = matchSubject(exam, subjects)
    const key = `e${i}`
    if (!subjectId) {
      return {
        ...exam,
        key,
        status: 'skipped',
        include: false,
        subjectId: null,
        existingId: null,
        previous: null,
      }
    }
    const match = findExisting(exam, subjectId, existing, used)
    if (match) used.add(match.id)
    const same =
      match &&
      !match.tentative &&
      match.date === exam.date &&
      (exam.time === null || exam.time === match.time)
    const status: ProposalStatus = !match ? 'new' : same ? 'unchanged' : 'changed'
    return {
      ...exam,
      key,
      status,
      include: status !== 'unchanged',
      subjectId,
      existingId: match?.id ?? null,
      previous:
        match && !same
          ? { date: match.date, dateLatest: match.dateLatest, tentative: match.tentative }
          : null,
    }
  })
}

/** Re-evaluates one exam after the user picked its subject in the full review. */
export function assignSubject(
  proposal: ExamProposal,
  subjectId: string,
  existing: readonly ExistingExam[],
): ExamProposal {
  const [updated] = proposeExams(
    [{ ...proposal, subject_id: subjectId }],
    [{ id: subjectId, name: proposal.subject_name }],
    existing,
  )
  return { ...updated!, key: proposal.key }
}

/** Items that "Spasi N" writes. */
export function toSave<T extends { include: boolean; status: ProposalStatus }>(
  items: readonly T[],
) {
  return items.filter((x) => x.include && (x.status === 'new' || x.status === 'changed'))
}

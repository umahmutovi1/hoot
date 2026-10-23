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
  title: string
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
  /** Title of the exam this one updates, so the review shows "II parcijala". */
  existingTitle: string | null
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
  exam: { subject_id: string | null; subject_name: string },
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
        existingTitle: null,
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
      existingTitle: match?.title ?? null,
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

// ------------------------------------------------------------------ class timetable

export type ClassKind = 'lecture' | 'exercise' | 'lab' | 'other'

export interface ParsedClass {
  subject_name: string
  subject_id: string | null
  kind: ClassKind
  /** 0 = Monday */
  weekday: number
  start: string
  end: string
  location: string | null
  week_parity: 'odd' | 'even' | null
  note: string | null
}

/** A class already in the timetable of the period the import goes to. */
export interface ExistingClass {
  id: string
  subjectId: string | null
  kind: ClassKind
  weekday: number
  startMin: number
  endMin: number
  location: string | null
  weekParity: 'odd' | 'even' | null
}

export interface ClassProposal extends ParsedClass {
  key: string
  status: ProposalStatus
  include: boolean
  subjectId: string | null
  existingId: string | null
  previous: { start: string; end: string; location: string | null } | null
}

export const clockToMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h! * 60 + m!
}
export const minToClock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/**
 * Classes from a timetable photo or text (PRD "Raspored nastave", Stage 10): the subject is the
 * model's id or the closest name (fuse.js); a class of the same subject, kind, day and week
 * parity that already exists is unchanged or changed (new time or room), the rest is new. A class
 * whose subject is not found waits for one to be picked.
 */
export function proposeClasses(
  parsed: readonly ParsedClass[],
  subjects: readonly ImportSubject[],
  existing: readonly ExistingClass[],
): ClassProposal[] {
  const used = new Set<string>()
  return parsed.map((c, i) => {
    const key = `c${i}`
    const subjectId = matchSubject(c, subjects)
    if (!subjectId)
      return {
        ...c,
        key,
        status: 'skipped',
        include: false,
        subjectId: null,
        existingId: null,
        previous: null,
      }
    const start = clockToMin(c.start)
    const end = clockToMin(c.end)
    const same = existing.filter(
      (e) =>
        !used.has(e.id) &&
        e.subjectId === subjectId &&
        e.kind === c.kind &&
        e.weekday === c.weekday &&
        e.weekParity === c.week_parity,
    )
    // The closest start among the subject's classes of that kind on that day.
    const match = [...same].sort(
      (a, b) => Math.abs(a.startMin - start) - Math.abs(b.startMin - start),
    )[0]
    if (match) used.add(match.id)
    const unchanged =
      match &&
      match.startMin === start &&
      match.endMin === end &&
      (c.location === null || (match.location ?? '') === c.location)
    const status: ProposalStatus = !match ? 'new' : unchanged ? 'unchanged' : 'changed'
    return {
      ...c,
      key,
      status,
      include: status !== 'unchanged',
      subjectId,
      existingId: match?.id ?? null,
      previous:
        match && !unchanged
          ? {
              start: minToClock(match.startMin),
              end: minToClock(match.endMin),
              location: match.location,
            }
          : null,
    }
  })
}

/** Re-evaluates one class after the user picked its subject in the full review. */
export function assignClassSubject(
  proposal: ClassProposal,
  subjectId: string,
  existing: readonly ExistingClass[],
): ClassProposal {
  const [updated] = proposeClasses(
    [{ ...proposal, subject_id: subjectId }],
    [{ id: subjectId, name: proposal.subject_name }],
    existing,
  )
  return { ...updated!, key: proposal.key }
}

// ------------------------------------------------------------------ deadlines from a calendar (Moodle)

export interface DeadlineEvent {
  id: string
  title: string | null
  /** The course (ICS CATEGORIES). */
  category: string | null
  /** Due instant, ISO. */
  startsAt: string
  deadlineId: string | null
  ignored: boolean
}

export interface ExistingDeadline {
  id: string
  dueAt: string
}

export interface DeadlineProposal {
  key: string
  eventId: string
  title: string
  dueAt: string
  category: string | null
  status: 'new' | 'changed'
  /** false = "Preskačem": the event is ignored from now on. */
  include: boolean
  subjectId: string | null
  deadlineId: string | null
  previousDueAt: string | null
}

/**
 * Kartica "N novih rokova iz Moodlea" (PRD "Povezani kalendari", vrsta "Rokovi"): upcoming events
 * of deadline feeds that are not imported yet (novo) or whose imported deadline has another date
 * now (izmijenjeno). Skipped events (`ignored`) never come back. Subject: the course name, else
 * the title (fuse.js); no match leaves the deadline without a subject until one is picked.
 */
export function proposeDeadlines(
  events: readonly DeadlineEvent[],
  subjects: readonly ImportSubject[],
  deadlines: readonly ExistingDeadline[],
  now: Date,
): DeadlineProposal[] {
  const out: DeadlineProposal[] = []
  const seen = new Set<string>()
  for (const e of [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    if (e.ignored || new Date(e.startsAt).getTime() < now.getTime()) continue
    const linked = e.deadlineId ? deadlines.find((d) => d.id === e.deadlineId) : undefined
    if (linked && new Date(linked.dueAt).getTime() === new Date(e.startsAt).getTime()) continue
    // A recurring series is one deadline per date; the same imported deadline is offered once.
    if (linked && seen.has(linked.id)) continue
    if (linked) seen.add(linked.id)
    const title = e.title?.trim() || e.category?.trim() || ''
    if (!title) continue
    const plain = normalize(title)
    const subjectId =
      matchSubject({ subject_id: null, subject_name: e.category ?? '' }, subjects) ??
      subjects.find((s) => plain.includes(normalize(s.name)))?.id ??
      matchSubject({ subject_id: null, subject_name: title }, subjects)
    out.push({
      key: e.id,
      eventId: e.id,
      title,
      dueAt: e.startsAt,
      category: e.category,
      status: linked ? 'changed' : 'new',
      include: true,
      subjectId,
      deadlineId: linked?.id ?? null,
      previousDueAt: linked?.dueAt ?? null,
    })
  }
  return out
}

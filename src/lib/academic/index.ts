import type { LocalDate } from '@/lib/day'

/**
 * Academic year and semester (PRD "Akademska godina i semestar", Stage 10c). Pure: which year and
 * semester a day falls in, the default semester of a new subject, how Predmeti groups subjects
 * ("prenesen" for an unpassed one with an active exam) and when to offer a new academic year.
 */

export interface AcademicYear {
  id: string
  /** "2026/27" */
  label: string
  /** 1–6, null when not known. */
  yearOfStudy: number | null
  startsOn: LocalDate
  endsOn: LocalDate
}

/** A teaching period of the academic calendar ("Zimski semestar"). */
export interface TeachingPeriod {
  startsOn: LocalDate
  endsOn: LocalDate
  academicYearId: string | null
}

/** The academic year starts on 1 October (faculties in BiH); September still ends the old one. */
const YEAR_START_MONTH = 10

export function yearLabelOn(date: LocalDate): string {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  const first = m >= YEAR_START_MONTH ? y : y - 1
  return `${first}/${String((first + 1) % 100).padStart(2, '0')}`
}

/** Default dates of a label: 1 October – 30 September. */
export function yearRange(label: string): { startsOn: LocalDate; endsOn: LocalDate } {
  const first = Number(label.slice(0, 4))
  return { startsOn: `${first}-10-01`, endsOn: `${first + 1}-09-30` }
}

export function yearOn<Y extends AcademicYear>(years: Y[], date: LocalDate): Y | null {
  return years.find((y) => y.startsOn <= date && date <= y.endsOn) ?? null
}

/** The year of `date`, else the latest one that has started (a gap in the summer), else none. */
export function currentYear<Y extends AcademicYear>(years: Y[], date: LocalDate): Y | null {
  return (
    yearOn(years, date) ??
    [...years]
      .filter((y) => y.startsOn <= date)
      .sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0] ??
    null
  )
}

/**
 * Semester number on a day (faculty numbering: 3 = winter of the 2nd year). The year's teaching
 * periods in order are its semesters: the one running, else the next one, else the last. Without
 * teaching periods: October–February is winter, March–September summer.
 */
export function semesterOn(year: AcademicYear, periods: TeachingPeriod[], date: LocalDate): number {
  const own = periods
    .filter(
      (p) =>
        p.academicYearId === year.id ||
        (p.academicYearId === null && p.startsOn >= year.startsOn && p.startsOn <= year.endsOn),
    )
    .sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1))
    .slice(0, 2)
  let index: number
  if (own.length > 0) {
    const running = own.findIndex((p) => p.startsOn <= date && date <= p.endsOn)
    const next = own.findIndex((p) => p.startsOn > date)
    index = running >= 0 ? running : next >= 0 ? next : own.length - 1
  } else {
    const m = Number(date.slice(5, 7))
    index = m >= YEAR_START_MONTH || m <= 2 ? 0 : 1
  }
  return (year.yearOfStudy ? (year.yearOfStudy - 1) * 2 : 0) + index + 1
}

/** Odd semesters are winter, even ones summer. */
export const isWinter = (semester: number) => semester % 2 === 1

export interface SubjectTerm {
  id: string
  academicYearId: string | null
  semesterNo: number | null
  /** Every exam passed or annulled (at least one exam). */
  done: boolean
  /** Has an exam that is neither passed nor annulled and still ahead (makeup, next term). */
  activeExam: boolean
}

export interface SubjectGroup<S> {
  key: string
  year: AcademicYear
  semester: number | null
  items: { subject: S; carried: boolean }[]
}

export interface GroupedSubjects<S> {
  /** The semester running now (open, no header button); null without academic years. */
  current: SubjectGroup<S> | null
  /** Semesters after the current one (subjects added ahead), nearest first. */
  later: SubjectGroup<S>[]
  /** Earlier semesters, newest first (collapsed). */
  earlier: SubjectGroup<S>[]
  /** Subjects without an academic year ("Bez semestra"). */
  none: S[]
}

/**
 * Predmeti by year and semester. A subject of an earlier semester that is not done and still has
 * an active exam stays in the current group as "prenesen"; once done it folds into its own
 * semester. Without any academic year everything is in `none`.
 */
export function groupSubjects<S extends SubjectTerm>(
  subjects: S[],
  years: AcademicYear[],
  current: { yearId: string; semester: number } | null,
): GroupedSubjects<S> {
  const byYear = new Map(years.map((y) => [y.id, y]))
  const groups = new Map<string, SubjectGroup<S>>()
  const none: S[] = []
  const keyOf = (yearId: string, semester: number | null) => `${yearId}:${semester ?? '-'}`
  const order = (g: { year: AcademicYear; semester: number | null }) =>
    `${g.year.startsOn}:${String(g.semester ?? 0).padStart(2, '0')}`
  const currentYear = current ? byYear.get(current.yearId) : undefined
  const currentOrder = currentYear
    ? order({ year: currentYear, semester: current!.semester })
    : null

  const groupFor = (year: AcademicYear, semester: number | null) => {
    const key = keyOf(year.id, semester)
    let g = groups.get(key)
    if (!g) {
      g = { key, year, semester, items: [] }
      groups.set(key, g)
    }
    return g
  }
  if (currentYear) groupFor(currentYear, current!.semester)

  for (const s of subjects) {
    const year = s.academicYearId ? byYear.get(s.academicYearId) : undefined
    if (!year) {
      none.push(s)
      continue
    }
    const own = order({ year, semester: s.semesterNo })
    const carried =
      currentYear !== undefined &&
      currentOrder !== null &&
      own < currentOrder &&
      !s.done &&
      s.activeExam
    if (carried) groupFor(currentYear, current!.semester).items.push({ subject: s, carried: true })
    else groupFor(year, s.semesterNo).items.push({ subject: s, carried: false })
  }

  const all = [...groups.values()]
  const currentGroup = current
    ? (groups.get(keyOf(current.yearId, current.semester)) ?? null)
    : null
  const others = all.filter((g) => g !== currentGroup && g.items.length > 0)
  return {
    current: currentGroup,
    later: others
      .filter((g) => currentOrder !== null && order(g) > currentOrder)
      .sort((a, b) => (order(a) < order(b) ? -1 : 1)),
    earlier: others
      .filter((g) => currentOrder === null || order(g) < currentOrder)
      .sort((a, b) => (order(a) < order(b) ? 1 : -1)),
    none,
  }
}

/**
 * "Nova akademska godina — dodati 2027/28?": when there are years but none covers today. Dates
 * are the default 1 Oct – 30 Sep, the year of study one more than the latest (at most 6).
 */
export function newYearOffer(
  years: AcademicYear[],
  today: LocalDate,
): { label: string; startsOn: LocalDate; endsOn: LocalDate; yearOfStudy: number | null } | null {
  if (years.length === 0 || yearOn(years, today)) return null
  const label = yearLabelOn(today)
  if (years.some((y) => y.label === label)) return null
  const latest = [...years].sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0]!
  if (latest.startsOn > today) return null
  return {
    label,
    ...yearRange(label),
    yearOfStudy: latest.yearOfStudy ? Math.min(6, latest.yearOfStudy + 1) : null,
  }
}

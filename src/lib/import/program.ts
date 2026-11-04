// A whole study programme (PRD "Dopune, 29. okt 2026" → Studijski program odjednom, Sprint 16)
// → every year and semester with its subjects, reviewed before saving. Years that do not exist
// yet are created with the default dates; subjects come without exams until their semester.
// Earlier semesters and elective options are offered but not preselected. Nothing is written here.
import type { ParsedProgramSubject } from '@shared/schemas.ts'
import { yearLabelOn, yearRange, type AcademicYear } from '@/lib/academic'
import type { LocalDate } from '@/lib/day'
import { matchSubject, type ImportSubject } from '.'

export interface ProgramSubjectProposal {
  key: string
  name: string
  ects: number | null
  electiveGroup: string | null
  /** An existing subject with this name: stays as it is. */
  existingId: string | null
  include: boolean
}

export interface ProgramSemester {
  semester: number
  yearOfStudy: number
  /** "2027/28"; null when the student's year of study is unknown. */
  yearLabel: string | null
  /** The academic year exists already. */
  yearId: string | null
  /** Before the student's current semester. */
  past: boolean
  subjects: ProgramSubjectProposal[]
}

export interface ProgramProposal {
  semesters: ProgramSemester[]
}

const shiftLabel = (label: string, years: number) => {
  const first = Number(label.slice(0, 4)) + years
  return `${first}/${String((first + 1) % 100).padStart(2, '0')}`
}

export function proposeProgram(
  parsed: ParsedProgramSubject[],
  ctx: {
    subjects: ImportSubject[]
    years: AcademicYear[]
    today: LocalDate
    /** The student's year of study now (profile or the current academic year), null if unknown. */
    yearOfStudy: number | null
    /** The semester running now (whole-programme number), null if unknown. */
    semester: number | null
  },
): ProgramProposal {
  const nowLabel = yearLabelOn(ctx.today)
  const bySemester = new Map<number, ParsedProgramSubject[]>()
  for (const p of parsed) bySemester.set(p.semester, [...(bySemester.get(p.semester) ?? []), p])
  const semesters = [...bySemester.keys()]
    .sort((a, b) => a - b)
    .map((semester) => {
      const yearOfStudy = Math.ceil(semester / 2)
      const yearLabel =
        ctx.yearOfStudy === null ? null : shiftLabel(nowLabel, yearOfStudy - ctx.yearOfStudy)
      const past = ctx.semester !== null && semester < ctx.semester
      return {
        semester,
        yearOfStudy,
        yearLabel,
        yearId: ctx.years.find((y) => y.label === yearLabel)?.id ?? null,
        past,
        subjects: bySemester.get(semester)!.map((p, i) => {
          const existingId = matchSubject(
            { subject_id: null, subject_name: p.subject_name },
            ctx.subjects,
            { exactOnly: true },
          )
          return {
            key: `${semester}:${i}`,
            name: p.subject_name.trim().slice(0, 80),
            ects: p.ects,
            electiveGroup: p.elective_group,
            existingId,
            include: existingId === null && !past && p.elective_group === null,
          }
        }),
      }
    })
  return { semesters }
}

/** New academic years the picked subjects need (default 1 Oct – 30 Sep). */
export function programYears(
  proposal: ProgramProposal,
): (Omit<AcademicYear, 'id'> & { label: string })[] {
  const out = new Map<string, Omit<AcademicYear, 'id'>>()
  for (const s of proposal.semesters) {
    if (s.yearId || !s.yearLabel || !s.subjects.some((x) => x.include && !x.existingId)) continue
    out.set(s.yearLabel, {
      label: s.yearLabel,
      yearOfStudy: s.yearOfStudy,
      ...yearRange(s.yearLabel),
    })
  }
  return [...out.values()]
}

export const programSaveCount = (p: ProgramProposal) =>
  p.semesters.reduce((n, s) => n + s.subjects.filter((x) => x.include && !x.existingId).length, 0)

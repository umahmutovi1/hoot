import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useAuth } from '@/features/auth/auth-context'
import { scheduleKey, usePeriods, useSavePeriod } from '@/features/schedule/api'
import { toPeriod } from '@/features/schedule/model'
import { useDayBoundary } from '@/features/settings/profile'
import { subjectsKey } from '@/features/subjects/api'
import { examAtFromDate, examKindDefaults, localDateAt } from '@/features/subjects/model'
import { addDays, localDay } from '@/lib/day'
import { useAcademicTerm } from '@/features/academic/api'
import { createChapterSource, createRoughSource } from '@/features/sources/api'
import { useRoughTexts } from '@/features/subjects/roughTexts'
import {
  syllabusSaveCount,
  type GradingProposal,
  type SyllabusProposal,
} from '@/lib/import/syllabus'
import { clockToMin, toSave, type ExamProposal, type PeriodProposal } from '@/lib/import'
import { currentTeachingPeriod, suggestExamPeriod } from '@/lib/schedule'
import { supabase } from '@/lib/supabase'
import type { ImportProposal } from './store'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']

/** "II parcijala" for a numbered partial, else the kind's name. */
export function examTitle(t: TFunction, exam: Pick<ExamProposal, 'kind' | 'number'>) {
  if (exam.kind === 'partial' && exam.number) {
    return t('owl.examTitle', { n: ROMAN[exam.number - 1] ?? String(exam.number) })
  }
  return t(`exams.kind.${exam.kind}`)
}

/** Exact time when the schedule gives one, else the app's default exam hour. */
function examAt(exam: Pick<ExamProposal, 'date' | 'time'>) {
  if (!exam.time) return examAtFromDate(exam.date)
  const [h, m] = exam.time.split(':').map(Number)
  return localDateAt(exam.date, h!, m!).toISOString()
}

/** How many items "Spasi N" writes (items without a subject wait for one). */
export function saveCount(proposal: ImportProposal) {
  return (
    toSave(proposal.periods).length +
    toSave(proposal.exams).filter((e) => e.subjectId).length +
    toSave(proposal.classes ?? []).filter((c) => c.subjectId).length +
    syllabusSaveCount(proposal.syllabus ?? [])
  )
}

/** "II parcijala" for a numbered partial of a syllabus, else the title as written. */
function gradingTitle(t: TFunction, g: GradingProposal) {
  if (g.examKind === 'partial' && g.number)
    return examTitle(t, { kind: 'partial', number: g.number })
  return g.title
}

/** Thrown when timetable classes have no teaching period to go into. */
export class NoTeachingPeriod extends Error {}

/** Writes the accepted items of a proposal ("Spasi N"); returns how many were saved. */
export function useSaveImport(t: TFunction) {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  const savePeriod = useSavePeriod()
  const { data: periodRows = [] } = usePeriods()
  const boundary = useDayBoundary()
  const { defaultTerm } = useAcademicTerm()
  const roughTexts = useRoughTexts()
  /**
   * Syllabus (Stage 10c): a new subject when asked (the syllabus's semester, else the current
   * one), picked books as rough sources until their contents come, topics, the chapters as a
   * temporary "Predavanja" source, exam points (only where none were entered) and the
   * subject's point total (only over the default). New exams take the matching period of the
   * academic calendar as a tentative date, else the end of the teaching period.
   */
  const saveSyllabus = async (items: SyllabusProposal[]) => {
    const pick = <T extends { include: boolean; status: string }>(xs: T[]) =>
      xs.filter((x) => x.include && (x.status === 'new' || x.status === 'changed'))
    const today = localDay(new Date(), boundary)
    const periods = periodRows.map(toPeriod)
    const teaching = currentTeachingPeriod(today, periods)
    let count = 0
    for (const item of items) {
      let subjectId = item.subjectId
      if (!subjectId) {
        if (!item.addSubject) continue
        subjectId = crypto.randomUUID()
        const { error } = await supabase.from('subjects').insert({
          id: subjectId,
          name: item.subjectName.slice(0, 80),
          color: 'lavender',
          // The semester the syllabus names (a whole year's syllabus has both), else today's.
          ...(defaultTerm
            ? {
                academic_year_id: defaultTerm.academicYearId,
                semester_no: item.semester ?? defaultTerm.semesterNo,
              }
            : {}),
        })
        if (error) throw error
        count++
      }
      for (const l of pick(item.literature)) {
        const title = (l.authors ? `${l.authors} — ${l.title}` : l.title).slice(0, 120)
        await createRoughSource({
          subjectId,
          size: 'medium',
          title,
          partTitle: roughTexts('medium').partTitle,
        })
        count++
      }
      const topics = pick(item.topics)
      if (topics.length > 0) {
        const { error } = await supabase.from('topics').insert(
          topics.map((x) => ({
            id: crypto.randomUUID(),
            subject_id: subjectId!,
            name: x.name.slice(0, 80),
          })),
        )
        if (error) throw error
        count += topics.length
      }
      if (item.chapters?.include) {
        // Chapters link to their topics: the ones just added and the ones the subject had.
        const { data: rows, error } = await supabase
          .from('topics')
          .select('id, name')
          .eq('subject_id', subjectId)
        if (error) throw error
        const idOf = new Map((rows ?? []).map((r) => [r.name.trim().toLowerCase(), r.id]))
        await createChapterSource({
          subjectId,
          title: t('owl.syllabus.chaptersSource'),
          parts: item.chapters.parts.map((x) => ({
            title: x.n > 1 ? `${x.name} (${x.k}/${x.n})` : x.name,
            topicId: idOf.get(x.name.slice(0, 80).trim().toLowerCase()) ?? null,
          })),
        })
        count++
      }
      let partial = 0
      for (const g of pick(item.grading.filter((x) => x.examKind))) {
        const passMinPct =
          g.points && g.passPoints !== null ? Math.round((g.passPoints / g.points) * 100) : null
        if (g.existingId) {
          const { error } = await supabase
            .from('assessments')
            .update({
              points_max: g.points,
              ...(passMinPct !== null ? { pass_min_pct: passMinPct } : {}),
            })
            .eq('id', g.existingId)
          if (error) throw error
        } else {
          const kind = g.examKind!
          const period =
            kind === 'partial'
              ? periods
                  .filter(
                    (x) => x.kind === 'exam' && x.examSession === 'partial' && x.endsOn >= today,
                  )
                  .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[partial++]
              : suggestExamPeriod(kind, periods, today)
          const start = period?.startsOn ?? teaching?.endsOn ?? addDays(today, 60)
          const end = period?.endsOn ?? addDays(start, 30)
          const defaults = examKindDefaults(kind)
          const { error } = await supabase.from('assessments').insert({
            id: crypto.randomUUID(),
            subject_id: subjectId,
            kind,
            title: gradingTitle(t, g).slice(0, 60),
            at: examAtFromDate(start),
            date_tentative: true,
            at_latest: examAtFromDate(end),
            exam_period_id: period?.id ?? null,
            scope_all: defaults.scopeAll,
            contingent: defaults.contingent,
            points_max: g.points,
            pass_min_pct: passMinPct,
          })
          if (error) throw error
        }
        count++
      }
      if (item.pointsTotal && item.pointsTotal.status !== 'unchanged') {
        const { error } = await supabase
          .from('subjects')
          .update({ points_total: item.pointsTotal.value })
          .eq('id', subjectId)
        if (error) throw error
        count++
      }
    }
    return count
  }

  return useMutation({
    mutationFn: async (proposal: ImportProposal) => {
      // Classes go into the current teaching period (PRD "Semestar"); check before writing.
      const classes = toSave(proposal.classes ?? []).filter((c) => c.subjectId)
      const teaching = currentTeachingPeriod(
        localDay(new Date(), boundary),
        periodRows.map(toPeriod),
      )
      if (classes.length > 0 && !teaching) throw new NoTeachingPeriod()

      const periods: PeriodProposal[] = toSave(proposal.periods)
      for (const p of periods) {
        await savePeriod.mutateAsync({
          id: p.existingId ?? crypto.randomUUID(),
          kind: p.kind,
          exam_session: p.kind === 'exam' ? p.exam_session : null,
          title: p.title,
          starts_on: p.starts_on,
          ends_on: p.ends_on,
        })
      }

      const exams = toSave(proposal.exams).filter((e) => e.subjectId)
      for (const e of exams) {
        if (e.existingId) {
          // A tentative date becomes exact: no duplicate, no range, no period link.
          const { error } = await supabase
            .from('assessments')
            .update({ at: examAt(e), date_tentative: false, at_latest: null, exam_period_id: null })
            .eq('id', e.existingId)
          if (error) throw error
        } else {
          const defaults = examKindDefaults(e.kind)
          const { error } = await supabase.from('assessments').insert({
            id: crypto.randomUUID(),
            subject_id: e.subjectId!,
            kind: e.kind,
            title: examTitle(t, e),
            at: examAt(e),
            scope_all: defaults.scopeAll,
            contingent: defaults.contingent,
          })
          if (error) throw error
        }
      }
      for (const c of classes) {
        const times = { start_min: clockToMin(c.start), end_min: clockToMin(c.end) }
        const { error } = c.existingId
          ? await supabase
              .from('timetable_entries')
              .update({ ...times, location: c.location, note: c.note })
              .eq('id', c.existingId)
          : await supabase.from('timetable_entries').insert({
              id: crypto.randomUUID(),
              subject_id: c.subjectId,
              kind: c.kind,
              weekday: c.weekday,
              ...times,
              location: c.location,
              week_parity: c.week_parity,
              note: c.note?.slice(0, 200) ?? null,
              period_id: teaching!.id,
              valid_from: teaching!.startsOn,
              valid_to: teaching!.endsOn,
            })
        if (error) throw error
      }
      const syllabusCount = await saveSyllabus(proposal.syllabus ?? [])
      return periods.length + exams.length + classes.length + syllabusCount
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sources', userId] }),
        queryClient.invalidateQueries({ queryKey: ['topics', userId] }),
        queryClient.invalidateQueries({ queryKey: ['plan', userId] }),
        queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: scheduleKey('timetable_entries', userId) }),
      ]),
  })
}

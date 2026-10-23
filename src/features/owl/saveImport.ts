import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useAuth } from '@/features/auth/auth-context'
import { scheduleKey, usePeriods, useSavePeriod } from '@/features/schedule/api'
import { toPeriod } from '@/features/schedule/model'
import { useDayBoundary } from '@/features/settings/profile'
import { subjectsKey } from '@/features/subjects/api'
import { examAtFromDate, examKindDefaults, localDateAt } from '@/features/subjects/model'
import { localDay } from '@/lib/day'
import { clockToMin, toSave, type ExamProposal, type PeriodProposal } from '@/lib/import'
import { currentTeachingPeriod } from '@/lib/schedule'
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
    toSave(proposal.classes ?? []).filter((c) => c.subjectId).length
  )
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
      return periods.length + exams.length + classes.length
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: scheduleKey('timetable_entries', userId) }),
      ]),
  })
}

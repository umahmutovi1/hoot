import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useAuth } from '@/features/auth/auth-context'
import { useSavePeriod } from '@/features/schedule/api'
import { subjectsKey } from '@/features/subjects/api'
import { examAtFromDate, examKindDefaults, localDateAt } from '@/features/subjects/model'
import { toSave, type ExamProposal, type PeriodProposal } from '@/lib/import'
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

/** Writes the accepted items of a proposal ("Spasi N"); returns how many were saved. */
export function useSaveImport(t: TFunction) {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  const savePeriod = useSavePeriod()
  return useMutation({
    mutationFn: async (proposal: ImportProposal) => {
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
      return periods.length + exams.length
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
  })
}

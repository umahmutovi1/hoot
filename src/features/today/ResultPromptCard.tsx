import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlagIcon } from '@/components/icons'
import { SNOOZE_DAYS, usePlanUi } from '@/features/plan/ui'
import { useGlobalScale } from '@/features/settings/profile'
import { useDeadlines } from '@/features/subjects/api'
import { gradeItemsOf, gradeSubjectOf, worthOf } from '@/features/subjects/grades'
import { ResultSheet } from '@/features/subjects/ResultSheet'
import { addDays } from '@/lib/day'
import { resultKey } from './results'
import { useAwaitingResults } from './useAwaitingResults'

/**
 * "Kako je prošao Midterm I?" after an exam day without a result: "Upiši rezultat" opens the
 * result sheet right here (the same one as on the subject), "Kasnije" asks again in a few days.
 * The result feeds the grade projection and tells Hoot the material is behind you.
 */
export function ResultPromptCard({ today }: { today: string }) {
  const { t } = useTranslation()
  const awaiting = useAwaitingResults(today)
  const snooze = usePlanUi((s) => s.snooze)
  const { data: deadlines = [] } = useDeadlines()
  const globalScale = useGlobalScale()
  const [open, setOpen] = useState<string | null>(null)
  const exam = awaiting[0]
  // Keep the sheet's exam while it closes, even after the saved result removes the card.
  const [shown, setShown] = useState(exam)
  if (exam && exam.id !== shown?.id && !open) setShown(exam)
  const target = shown
  if (!target) return null
  const subject = target.subject
  const items = gradeItemsOf(
    subject,
    deadlines.filter((d) => d.subject_id === subject.id),
  )
  const worth = worthOf(target.id, items, gradeSubjectOf(subject, globalScale).pointsTotal)
  return (
    <>
      {exam && (
        <div className="surface flex flex-col gap-3 rounded-card p-4">
          <div className="flex items-start gap-3">
            <span
              className="icon-tile flex size-[38px] shrink-0 items-center justify-center rounded-[12px]"
              aria-hidden="true"
            >
              <FlagIcon size={18} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{t('today.result.title')}</span>
              <span className="text-[13px] leading-[1.35] text-ink-muted">
                {t('today.result.sub', { subject: exam.subject.name, exam: exam.title })}
              </span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShown(exam)
                setOpen(exam.id)
              }}
              className="btn-primary h-11 flex-1 rounded-full text-sm font-semibold"
            >
              {t('today.result.enter')}
            </button>
            <button
              type="button"
              onClick={() => snooze(resultKey(exam.id), addDays(today, SNOOZE_DAYS - 1))}
              className="h-11 flex-1 rounded-full bg-canvas text-sm font-semibold text-brand"
            >
              {t('today.result.later')}
            </button>
          </div>
        </div>
      )}
      <ResultSheet
        target={{ kind: 'exam', row: target }}
        subjectName={subject.name}
        worth={worth}
        open={open === target.id}
        onOpenChange={(o) => setOpen(o ? target.id : null)}
      />
    </>
  )
}

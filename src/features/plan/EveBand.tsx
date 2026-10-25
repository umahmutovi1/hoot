import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/toast-store'
import { useSetEveReserved, useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { relativeDays } from '@/features/subjects/format'
import { diffDays, type LocalDate } from '@/lib/day'
import { reservedDays } from '@/lib/scheduler'
import { cn } from '@/lib/utils'
import { usePlanStore } from './store'

/**
 * Plan → Dan on a day reserved before an exam ("Dan pred ispit"): which subject it is for, and
 * "Ukloni" to give it back to the plan (toast with undo).
 */
export function EveBand({ date }: { date: LocalDate }) {
  const { t } = useTranslation()
  const state = usePlanStore((s) => s.model?.built.state)
  const { data: subjects = [] } = useSubjects()
  const setEve = useSetEveReserved()
  const show = useToast((s) => s.show)
  const goal = state ? reservedDays(state).get(date) : undefined
  if (!goal) return null
  const subject = subjects.find((s) => s.id === goal.subjectId)
  const palette = paletteOf(subject?.color ?? null)
  return (
    <div
      className={cn(
        'flex min-h-11 items-center gap-2.5 rounded-[18px] py-1 pr-1 pl-3.5 text-sm font-semibold',
        palette.soft,
        palette.deepText,
      )}
    >
      <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', palette.bar)} />
      <span className="flex-1">
        {t('plan.eve.band', {
          subject: subject?.name ?? '',
          when: relativeDays(t, diffDays(date, goal.on)),
        })}
      </span>
      <button
        type="button"
        onClick={() => {
          setEve.mutate({ id: goal.id, value: false })
          show(t('plan.eve.removed'), {
            label: t('today.cant.undo'),
            run: () => setEve.mutate({ id: goal.id, value: true }),
          })
        }}
        className="flex h-10 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold"
      >
        {t('plan.eve.remove')}
      </button>
    </div>
  )
}

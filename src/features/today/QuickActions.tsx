import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { ClockIcon, CloseIcon } from '@/components/icons'
import { useToast } from '@/components/toast-store'
import { useCantToday } from '@/features/plan/actions'
import { isOpen, useGoalTitle } from '@/features/plan/model'
import { formatDuration } from '@/features/sources/format'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import { toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { ONLY_MINUTES, pickFor, pickTitle, useStartPick } from './pick'
import type { PlanToday } from './usePlanToday'

const button =
  'glass flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold'

/** "Danas ne mogu" and "Imam samo 30 min" under the next block (PRD "Brze akcije dana"). */
export function QuickActions({ plan, dayOff }: { plan: PlanToday; dayOff: boolean }) {
  const { t } = useTranslation()
  const cantToday = useCantToday()
  const show = useToast((s) => s.show)
  const [pickOpen, setPickOpen] = useState(false)
  const hasWork = plan.blocks.some((b) => isOpen(b) && b.on_date >= plan.today)

  const cant = async () => {
    const undo = await cantToday(plan.today)
    show(t('today.cant.toast'), { label: t('today.cant.undo'), run: () => void undo() })
  }

  return (
    <div className="flex gap-2">
      {!dayOff && plan.todayBlocks.some(isOpen) && (
        <button type="button" onClick={() => void cant()} className={button}>
          <CloseIcon size={16} />
          {t('today.cant.button')}
        </button>
      )}
      {hasWork && (
        <button type="button" onClick={() => setPickOpen(true)} className={button}>
          <ClockIcon size={17} />
          {t('today.only.button')}
        </button>
      )}
      <OnlySheet open={pickOpen} onOpenChange={setPickOpen} plan={plan} />
    </div>
  )
}

/** "Imam samo…" sheet: 15 / 30 / 45 / 60 min and the most valuable piece for that time. */
export function OnlySheet({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: PlanToday
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('today.only.title')}>
      {open && <OnlyForm plan={plan} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function OnlyForm({ plan, onDone }: { plan: PlanToday; onDone: () => void }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [minutes, setMinutes] = useState<number>(30)
  const { data: subjects = [] } = useSubjects()
  const startPick = useStartPick(plan)
  const goalTitle = useGoalTitle()
  const pick = pickFor(plan, minutes)
  const block = pick ? plan.blocks.find((b) => b.id === pick.blockId) : undefined
  const later =
    pick?.from === 'next'
      ? plan.blocks.find(
          (b) => isOpen(b) && b.on_date > plan.today && b.subject_id === pick.subjectId,
        )
      : undefined
  const subjectName = subjects.find((s) => s.id === pick?.subjectId)?.name ?? ''

  const why = !pick
    ? null
    : pick.from === 'review'
      ? t('today.only.whyReview', { minutes: formatDuration(t, pick.minutes) })
      : pick.from === 'today'
        ? block && pick.minutes < block.planned_minutes
          ? t('today.only.whyPart')
          : t('today.only.whyWhole')
        : t('today.only.whyNext', {
            day: later
              ? format(toDisplayDate(later.on_date), 'EEEE', { locale: dateFnsLocales[locale] })
              : '',
          })

  const start = async () => {
    if (!pick) return
    await startPick(pick)
    onDone()
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-2" role="radiogroup" aria-label={t('today.only.title')}>
        {ONLY_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === minutes}
            onClick={() => setMinutes(m)}
            className={cn(
              'h-12 flex-1 rounded-full text-[15px] font-semibold',
              m === minutes ? 'bg-ink text-white' : 'glass-flat text-ink',
            )}
          >
            {t('time.minutes', { m })}
          </button>
        ))}
      </div>
      {pick ? (
        <>
          <div className="flex flex-col gap-1 rounded-[20px] bg-white/70 px-4 py-3.5">
            <span className="text-xs font-semibold text-ink-muted uppercase">
              {t('today.only.best')}
            </span>
            <span className="text-[17px] font-semibold">
              {pickTitle(
                t,
                pick,
                plan.units,
                subjectName,
                goalTitle((block ?? later)?.deadline_id ?? ''),
              )}
            </span>
            {why && <span className="text-[13px] text-ink-secondary">{why}</span>}
          </div>
          <button
            type="button"
            onClick={() => void start()}
            className="btn-primary flex h-[52px] items-center justify-center rounded-full text-[15px] font-semibold"
          >
            {t('today.only.start', { minutes })}
          </button>
          {block && pick.minutes < block.planned_minutes && (
            <span className="text-center text-xs text-ink-muted">{t('today.only.rest')}</span>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-muted">{t('today.only.nothing')}</p>
      )}
    </div>
  )
}

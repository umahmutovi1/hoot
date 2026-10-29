import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { CapIcon, ChevronRightIcon, ClockIcon, PlusIcon, SparkleIcon } from '@/components/icons'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useLocale } from '@/features/settings/useLocale'
import { formatDuration } from '@/features/sources/format'
import { toDisplayDate, type LocalDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { capFor, freeMinutesOn } from '@/lib/schedule'

export type EditDayAction = 'slots' | 'more' | 'block' | 'restore'

/**
 * "Uredi dan" (Plan → Dan): every change for the selected day in one place, so it is clear the day
 * can be edited (decision, October 2026: replaces the Raspored and Dostupnost header buttons).
 * This day first (study time, more time, a block), then the week template and the timetable.
 */
export function EditDaySheet({
  date,
  open,
  onOpenChange,
  onAction,
  restorable = 0,
}: {
  date: LocalDate
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (action: EditDayAction) => void
  /** Moved (Fixed) blocks of the day that "Vrati predloženi plan" would give back to the plan. */
  restorable?: number
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const data = useScheduleData()
  const input = data.dayInput(date)
  const title = format(toDisplayDate(date), 'EEEE, d. MMMM', { locale: dateFnsLocales[locale] })
  const pick = (action: EditDayAction) => {
    onOpenChange(false)
    onAction(action)
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('plan.editDay.title', { day: title })}
      subtitle={t('availability.dayLine', {
        free: formatDuration(t, freeMinutesOn(date, input)),
        cap: formatDuration(t, capFor(date, input)),
      })}
    >
      <div className="flex flex-col gap-2">
        <Row
          icon={<ClockIcon size={20} className="text-brand" />}
          title={t('plan.editDay.slots')}
          sub={t('plan.editDay.slotsSub')}
          onClick={() => pick('slots')}
        />
        <Row
          icon={<ClockIcon size={20} className="text-brand" />}
          title={t('plan.more.title')}
          sub={t('plan.editDay.moreSub')}
          onClick={() => pick('more')}
        />
        <Row
          icon={<PlusIcon size={20} className="text-brand" />}
          title={t('plan.editDay.block')}
          sub={t('plan.editDay.blockSub')}
          onClick={() => pick('block')}
        />
        {restorable > 0 && (
          <Row
            icon={<SparkleIcon size={20} className="text-brand" />}
            title={t('plan.restore.row')}
            sub={t('plan.restore.rowSub', { count: restorable })}
            onClick={() => pick('restore')}
          />
        )}
        <span className="mt-3 px-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {t('plan.editDay.always')}
        </span>
        <Row
          icon={<ClockIcon size={20} className="text-brand" />}
          title={t('availability.title')}
          sub={t('plan.editDay.weekSub')}
          to="/plan/availability"
        />
        <Row
          icon={<CapIcon size={20} className="text-brand" />}
          title={t('plan.editDay.timetable')}
          sub={t('plan.editDay.timetableSub')}
          to="/plan/timetable"
        />
        <p className="mt-2 px-1 text-xs leading-[1.45] text-ink-muted">
          {t('plan.schedule.note')} · {t('plan.schedule.moved')}
        </p>
      </div>
    </BottomSheet>
  )
}

function Row({
  icon,
  title,
  sub,
  onClick,
  to,
}: {
  icon: ReactNode
  title: string
  sub: string
  onClick?: () => void
  to?: string
}) {
  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/60">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold text-ink">{title}</span>
        <span className="truncate text-[13px] text-ink-muted">{sub}</span>
      </span>
      <ChevronRightIcon size={18} className="shrink-0 text-ink-subtle" />
    </>
  )
  const className =
    'flex min-h-14 w-full items-center gap-3 rounded-[20px] bg-white/50 px-3 py-2.5 text-left'
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  )
}

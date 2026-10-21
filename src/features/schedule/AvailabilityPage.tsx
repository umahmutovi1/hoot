import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BackHeader } from '@/components/BackHeader'
import { PencilIcon } from '@/components/icons'
import { useAgenda } from '@/features/plan/agenda'
import { DayStrip } from '@/features/plan/DayStrip'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { formatDuration } from '@/features/sources/format'
import { localDateOf } from '@/features/subjects/model'
import { localDay, toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { capFor, freeMinutesOn, slotMinutes, slotsFor, studyMinutesOn } from '@/lib/schedule'
import { AvailabilityTimeline } from './AvailabilityTimeline'
import { DaySheet } from './DaySheet'
import { useScheduleData } from './useScheduleData'

/**
 * Dostupnost: a real week with dates and the selected day on a time axis (slots, classes, cap).
 * "Uredi dan" changes this day only or every such weekday; classes show on the time axis.
 */
export function AvailabilityPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const [selected, setSelected] = useState(() => toDisplayDate(today))
  const date = localDateOf(selected.toISOString())
  const data = useScheduleData()
  const agenda = useAgenda()
  const [sheetOpen, setSheetOpen] = useState(false)

  const input = data.dayInput(date)
  const day = data.dayRows.find((d) => d.on_date === date)
  const free = freeMinutesOn(date, input)
  // Slots before classes are taken out, so "8h termina − 2h 15 nastava" explains the free time.
  const slotTotal = slotMinutes(slotsFor(date, input))
  const dfLocale = dateFnsLocales[locale]

  return (
    <div className="flex flex-col gap-4">
      <BackHeader title={t('availability.title')} fallback="/plan" />
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-tight font-bold">{t('availability.heading')}</h1>
        <p className="text-sm leading-[1.45] text-ink-muted">
          {t('availability.totalBefore')}{' '}
          <b className="text-ink">{formatDuration(t, data.weekMinutes(date))}</b>{' '}
          {t('availability.totalAfter')}
        </p>
      </div>

      <DayStrip selected={selected} today={toDisplayDate(today)} onSelect={setSelected} />

      <div className="flex flex-col gap-3 rounded-card-lg glass p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-base font-semibold first-letter:uppercase">
              {format(selected, 'EEEE, d. MMM', { locale: dfLocale })}
            </span>
            <span className="text-[13px] text-ink-muted">
              {t('availability.dayLine', {
                free: formatDuration(t, free),
                cap: formatDuration(t, capFor(date, input)),
              })}
            </span>
            {slotTotal > free && (
              <span className="text-xs text-ink-subtle">
                {t('availability.breakdown', {
                  slots: formatDuration(t, slotTotal),
                  busy: formatDuration(t, slotTotal - free),
                })}
              </span>
            )}
            {day && (
              <span className="self-start rounded-lg bg-brand-soft px-2 py-[3px] text-[11px] font-semibold text-avatar-ink">
                {t('availability.onlyThisDay')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full btn-primary px-3.5 text-sm font-semibold"
          >
            <PencilIcon size={15} />
            {t('availability.editDay')}
          </button>
        </div>
        <AvailabilityTimeline slots={slotsFor(date, input)} classes={agenda.classesFor(date)} />
        <span className="text-xs text-ink-muted">
          {t('availability.planUses', {
            time: formatDuration(t, studyMinutesOn(date, input)),
          })}
        </span>
      </div>

      <DaySheet date={date} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}

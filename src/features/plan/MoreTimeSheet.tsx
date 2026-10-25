import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { useToast } from '@/components/toast-store'
import { useDeleteDay, useSaveDay } from '@/features/schedule/api'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useLocale } from '@/features/settings/useLocale'
import { formatDuration } from '@/features/sources/format'
import { toDisplayDate, type LocalDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { capFor, freeSlotsOn } from '@/lib/schedule'

const MORE = [30, 60, 120, 180]

/**
 * "Više vremena ovaj dan" (PRD "Navigacija, pretraga, teme i geste", Stage 10b): one tap raises
 * the day's maximum (`availability_days.cap_min`), with undo; the replan fills it. Opened from
 * Plan → Dan and from search.
 */
export function MoreTimeSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: LocalDate
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const schedule = useScheduleData()
  const save = useSaveDay()
  const remove = useDeleteDay()
  const show = useToast((s) => s.show)
  const input = schedule.dayInput(date)
  const cap = capFor(date, input)
  const free = freeSlotsOn(date, input).reduce((s, x) => s + x.endMin - x.startMin, 0)
  const day = format(toDisplayDate(date), 'EEEE, d. MMMM', { locale: dateFnsLocales[locale] })

  const raise = (extra: number) => {
    const existing = schedule.dayRows.find((d) => d.on_date === date)
    const id = existing?.id ?? crypto.randomUUID()
    save.mutate({ id, on_date: date, slots: existing?.slots ?? null, cap_min: cap + extra })
    onOpenChange(false)
    show(t('plan.more.done', { day, cap: formatDuration(t, cap + extra) }), {
      label: t('today.cant.undo'),
      run: () => {
        if (existing) save.mutate(existing)
        else remove.mutate(id)
      },
    })
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('plan.more.title')}
      subtitle={t('plan.more.sub', { day, cap: formatDuration(t, cap) })}
    >
      <div className="grid grid-cols-2 gap-2">
        {MORE.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => raise(m)}
            className="h-12 rounded-full glass text-[15px] font-semibold"
          >
            +{formatDuration(t, m)}
          </button>
        ))}
      </div>
      {cap >= free && <p className="text-[13px] text-ink-muted">{t('plan.more.fullDay')}</p>}
    </BottomSheet>
  )
}

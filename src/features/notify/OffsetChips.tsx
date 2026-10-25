import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { REMINDER_OFFSETS } from './jobs'

/** Reminder offsets before a block (2 h … 5 min), several at once; none = no reminders. */
export function OffsetChips({
  value,
  onChange,
}: {
  value: number[]
  onChange: (offsets: number[]) => void
}) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={t('notify.offsetsLabel')} className="flex flex-wrap gap-1.5">
      {REMINDER_OFFSETS.map((o) => {
        const on = value.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((x) => x !== o) : [...value, o].sort((a, b) => b - a))
            }
            className={cn(
              'flex h-[38px] min-w-11 items-center justify-center rounded-full px-3 text-[13px] font-semibold',
              on ? 'bg-ink text-white' : 'bg-white/50 text-ink',
            )}
          >
            {t(`notify.offset.${o}`)}
          </button>
        )
      })}
    </div>
  )
}

import { cn } from '@/lib/utils'

/** Radio row for a unit ("Sad radim na", start sheet). */
export function UnitOption({
  checked,
  title,
  meta,
  trailing,
  onSelect,
}: {
  checked: boolean
  title: string
  meta?: string | null
  trailing?: string | null
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-[18px] p-3 text-left',
        checked ? 'bg-brand-soft' : 'glass',
      )}
    >
      <span
        className={cn(
          'flex size-[22px] shrink-0 items-center justify-center rounded-full border-2',
          checked ? 'border-brand' : 'border-radio-ring',
        )}
      >
        <span className={cn('size-2.5 rounded-full', checked && 'bg-brand')} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{title}</span>
        {meta && <span className="text-xs text-ink-muted">{meta}</span>}
      </span>
      {trailing && <span className="text-[13px] font-semibold text-brand">{trailing}</span>}
    </button>
  )
}

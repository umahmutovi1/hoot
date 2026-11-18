import { MinusIcon, PlusIcon } from '@/components/icons'

/** "Trajanje 40 min − +" (PokreniSesiju): a value with plain − and + icon buttons. */
export function Stepper({
  label,
  value,
  less,
  more,
  onLess,
  onMore,
  min,
  max,
}: {
  label: string
  value: string
  /** aria-labels of − and +. */
  less: string
  more: string
  onLess: () => void
  onMore: () => void
  /** − / + are off at the ends of the range. */
  min: boolean
  max: boolean
}) {
  return (
    <div className="flex min-h-14 items-center gap-2 rounded-[16px] bg-raised py-1.5 pr-1.5 pl-4 shadow-[inset_0_0_0_1.5px_var(--color-line)]">
      <span className="flex-1 text-[15px] font-semibold">{label}</span>
      <button
        type="button"
        aria-label={less}
        disabled={min}
        onClick={onLess}
        className="flex size-11 items-center justify-center text-brand-strong disabled:opacity-40"
      >
        <MinusIcon size={20} />
      </button>
      <span
        aria-live="polite"
        className="min-w-16 text-center font-display text-xl font-bold tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={more}
        disabled={max}
        onClick={onMore}
        className="flex size-11 items-center justify-center text-brand-strong disabled:opacity-40"
      >
        <PlusIcon size={20} />
      </button>
    </div>
  )
}

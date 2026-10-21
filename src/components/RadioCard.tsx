import { cn } from '@/lib/utils'

interface RadioCardProps {
  checked: boolean
  title: string
  subtitle?: string
  onSelect: () => void
  className?: string
}

/** Radio option as a card with a ring dot, as in NoviPredmet ("Kako se polaže?"). */
export function RadioCard({ checked, title, subtitle, onSelect, className }: RadioCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 rounded-[20px] border-2 glass p-3.5 text-left',
        checked ? 'border-brand-accent' : 'border-surface',
        className,
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
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        {subtitle && <span className="text-xs text-ink-muted">{subtitle}</span>}
      </span>
    </button>
  )
}

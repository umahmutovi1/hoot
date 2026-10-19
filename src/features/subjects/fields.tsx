import { cn } from '@/lib/utils'

export const fieldLabel = 'text-sm font-semibold'
export const fieldInput =
  'h-[54px] rounded-input border-2 border-transparent bg-canvas px-4 text-base outline-none focus-visible:border-brand-accent aria-invalid:border-danger'

interface ChipGroupProps<T extends string> {
  options: { value: T; label: string; dot?: string }[]
  value: T | null
  onChange: (value: T) => void
}

/** Single-choice pill chips (Tip / Predmet in the UrediBlok mockup). */
export function ChipGroup<T extends string>({ options, value, onChange }: ChipGroupProps<T>) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex h-[38px] items-center gap-2 rounded-full px-3 text-[13px] font-semibold',
            value === o.value ? 'bg-brand text-white' : 'bg-canvas text-ink',
          )}
        >
          {o.dot && <span className={cn('size-2.5 rounded-full', o.dot)} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

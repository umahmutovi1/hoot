import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  label: string
  /** The label is only for screen readers (the row shows its own text). */
  hideLabel?: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/** Labeled toggle with a 44 px touch target. */
export function Switch({ checked, label, onChange, disabled, hideLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-center gap-2 text-[13px] disabled:opacity-50"
    >
      <span
        className={cn(
          'flex h-6 w-10 rounded-full p-0.5 transition-colors',
          checked ? 'justify-end bg-brand' : 'justify-start bg-radio-ring',
        )}
      >
        <span className="size-5 rounded-full glass" />
      </span>
      {hideLabel ? <span className="sr-only">{label}</span> : label}
    </button>
  )
}

import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/** Labeled toggle with a 44 px touch target. */
export function Switch({ checked, label, onChange, disabled }: SwitchProps) {
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
      {label}
    </button>
  )
}

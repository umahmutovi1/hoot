import { useState } from 'react'
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

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}

/** Segmented control ("bodova / % ocjene") as in the BodoviOcjene mockup. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex rounded-[16px] bg-canvas p-[3px]', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex h-10 flex-1 items-center justify-center rounded-[13px] px-3 text-[13px] font-semibold whitespace-nowrap',
            value === o.value ? 'bg-surface text-ink' : 'text-ink-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface NumberFieldProps {
  value: number | null
  onChange: (value: number | null) => void
  label: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}

/**
 * Decimal input that keeps what is typed ("12," while typing) and reports a number or null.
 * Remount it (key) when the value changes from outside, e.g. on a unit switch.
 */
export function NumberField({
  value,
  onChange,
  label,
  placeholder,
  disabled,
  invalid,
  className,
}: NumberFieldProps) {
  const [text, setText] = useState(value === null ? '' : String(roundForInput(value)))
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid}
      placeholder={placeholder}
      disabled={disabled}
      value={disabled && value !== null ? String(roundForInput(value)) : text}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseDecimal(e.target.value)
        onChange(n)
      }}
      className={cn(fieldInput, 'min-w-0 disabled:text-ink-muted', className)}
    />
  )
}

function roundForInput(n: number) {
  return Math.round(n * 100) / 100
}

/** "12,5" or "12.5" → 12.5; empty or invalid → null. */
function parseDecimal(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

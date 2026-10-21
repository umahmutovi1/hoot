import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Pill chip from the session mockups: dark when picked (subjects) or brand (study mode). */
export function Chip({
  selected,
  onClick,
  tone = 'dark',
  children,
}: {
  selected: boolean
  onClick: () => void
  tone?: 'dark' | 'brand'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'flex h-11 items-center rounded-full px-4 text-[13px] font-semibold',
        selected
          ? tone === 'dark'
            ? 'bg-ink text-white'
            : 'bg-brand text-white'
          : tone === 'dark'
            ? 'bg-canvas text-ink'
            : 'border border-line glass font-normal text-ink',
      )}
    >
      {children}
    </button>
  )
}

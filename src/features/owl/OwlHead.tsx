import { AiSparkIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

/** The assistant's avatar: the AI spark on a glass circle, dimmed when it is unavailable. */
export function OwlHead({
  enabled = true,
  size = 44,
  className,
}: {
  enabled?: boolean
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-white/60',
        enabled ? 'text-brand-accent' : 'text-ink-subtle',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <AiSparkIcon size={Math.round(size * 0.48)} />
    </span>
  )
}

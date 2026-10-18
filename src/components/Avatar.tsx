import { cn } from '@/lib/utils'

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-full bg-avatar text-lg font-bold text-avatar-ink',
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

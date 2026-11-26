import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

// Skeletons shaped like the screen (PRD "Dopune, 29. okt 2026" → Doživljaj); spinners only in
// buttons. Pulse stops with reduced motion.

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-2xl bg-white/45 motion-reduce:animate-none', className)}
    />
  )
}

/** A surface card holding grey lines; `rows` lines under a title line. */
export function SkeletonCard({ rows = 2, className }: { rows?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('surface flex flex-col gap-2.5 rounded-card-lg p-[18px]', className)}
    >
      <Skeleton className="h-4 w-2/5" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('h-3', i === rows - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  )
}

/** Screen-reader text for a loading region. */
export function LoadingLabel() {
  const { t } = useTranslation()
  return <span className="sr-only">{t('app.loading')}</span>
}

/** Danas: focus bar, "Sljedeće", quick actions, today's schedule. */
export function TodaySkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3.5">
      <LoadingLabel />
      <div
        aria-hidden="true"
        className="surface mt-4 flex items-center gap-4 rounded-card-lg p-[18px]"
      >
        <Skeleton className="size-20 shrink-0 rounded-full" />
        <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </div>
      <Skeleton className="h-40 rounded-card-lg" />
      <div className="flex gap-2.5">
        <Skeleton className="h-12 flex-1 rounded-full" />
        <Skeleton className="h-12 flex-1 rounded-full" />
      </div>
      <SkeletonCard rows={3} />
    </div>
  )
}

/** A list of cards (Predmeti, Napredak). */
export function ListSkeleton({ count = 3, rows = 2 }: { count?: number; rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <LoadingLabel />
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} rows={rows} />
      ))}
    </div>
  )
}

/** A detail screen (Predmet, Izvor): title, subtitle, then cards. */
export function DetailSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3 pt-2">
      <LoadingLabel />
      <Skeleton className="h-9 w-3/5" />
      <Skeleton className="mb-2 h-4 w-2/5" />
      <SkeletonCard rows={3} />
      <SkeletonCard rows={2} />
      <SkeletonCard rows={2} />
    </div>
  )
}

/** Plan day view: a column of blocks. */
export function BlocksSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-2.5">
      <LoadingLabel />
      <Skeleton className="h-16 rounded-card" />
      <Skeleton className="h-24 rounded-card" />
      <Skeleton className="h-16 rounded-card" />
    </div>
  )
}

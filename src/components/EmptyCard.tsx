import type { ReactNode } from 'react'

export function EmptyCard({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-card-lg bg-surface p-5">
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      <div className="text-sm leading-snug text-ink-muted">{children}</div>
    </div>
  )
}

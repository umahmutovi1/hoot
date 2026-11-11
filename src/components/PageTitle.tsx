import type { ReactNode } from 'react'
import { InHeader } from '@/app/layout/ScreenHeader'

/**
 * Tab screen title in the blue header (board DanasA): the title on the left (with an optional tag
 * right after it, e.g. the Google sync state on Plan), the screen's own icon actions on the right,
 * and an optional line under it.
 */
export function PageTitle({
  children,
  actions,
  tag,
  sub,
}: {
  children: ReactNode
  actions?: ReactNode
  tag?: ReactNode
  sub?: ReactNode
}) {
  return (
    <InHeader>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="min-w-0 truncate text-[44px] leading-none font-bold tracking-[-0.03em]">
            {children}
          </h1>
          {tag}
        </div>
        {actions && <div className="-mr-2 flex shrink-0">{actions}</div>}
      </div>
      {sub && <p className="mt-1.5 text-base text-ground/80">{sub}</p>}
    </InHeader>
  )
}

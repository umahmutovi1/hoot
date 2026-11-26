import type { ReactNode } from 'react'
import { InHeader } from '@/app/layout/ScreenHeader'

/**
 * Title of a screen below the main ones, in the blue header under ‹ (board Izgled). `actions` are
 * the screen's own icon buttons (plain icons, 44 px), on the right of the title.
 */
export function ScreenTitle({
  title,
  sub,
  actions,
}: {
  title: string
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <InHeader>
      <div className="flex items-start justify-between gap-2">
        <h1 className="min-w-0 text-[36px] leading-[1.02] font-bold wrap-break-word">{title}</h1>
        {actions && <div className="-mt-1 -mr-2 flex shrink-0">{actions}</div>}
      </div>
      {sub && <p className="mt-1.5 text-[15px] text-ground/85">{sub}</p>}
    </InHeader>
  )
}

import type { ReactNode } from 'react'

/**
 * Tab screen header: the title on the left (with an optional tag right after it, e.g. the Google
 * sync state on Plan) and the screen's own actions on the right.
 */
export function PageTitle({
  children,
  actions,
  tag,
}: {
  children: ReactNode
  actions?: ReactNode
  tag?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="min-w-0 truncate text-[30px] font-bold tracking-[-0.6px]">{children}</h1>
        {tag}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}

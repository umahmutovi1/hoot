import type { ReactNode } from 'react'

/** Tab screen header: the title on the left and the screen's own actions on the right. */
export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h1 className="min-w-0 truncate text-[30px] font-bold tracking-[-0.6px]">{children}</h1>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}

import type { ReactNode } from 'react'

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-[30px] font-bold">{children}</h1>
      {action}
    </div>
  )
}

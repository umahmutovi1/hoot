import type { ReactNode } from 'react'
import { ProfileButton } from '@/features/settings/ProfileButton'

/** Tab screen header: title on the left, optional actions and the profile avatar on the right. */
export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h1 className="min-w-0 truncate text-[30px] font-bold">{children}</h1>
      <div className="flex shrink-0 items-center gap-1.5">
        {action}
        <ProfileButton />
      </div>
    </div>
  )
}

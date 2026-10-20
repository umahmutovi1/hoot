import type { ReactNode } from 'react'
import { ProfileButton } from '@/features/settings/ProfileButton'

/** Tab screen header: only the title on the left and the profile avatar on the right. */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h1 className="min-w-0 truncate text-[30px] font-bold">{children}</h1>
      <ProfileButton />
    </div>
  )
}

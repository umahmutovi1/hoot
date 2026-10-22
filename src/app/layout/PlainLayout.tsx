import { Outlet } from 'react-router-dom'
import { LocaleSync } from '@/features/settings/LocaleSync'

/** Signed-in screens without the bottom navigation (settings, session flow). */
export function PlainLayout() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-6 pb-[calc(24px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))]">
      <LocaleSync />
      <Outlet />
    </div>
  )
}

import { Outlet } from 'react-router-dom'
import { LocaleSync } from '@/features/settings/LocaleSync'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-6 pb-[calc(112px+env(safe-area-inset-bottom))]">
      <LocaleSync />
      <Outlet />
      <BottomNav />
    </div>
  )
}

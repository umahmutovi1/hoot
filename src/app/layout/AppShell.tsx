import { Outlet } from 'react-router-dom'
import { ForgottenGuard } from '@/features/session/ForgottenGuard'
import { SessionStartSheet } from '@/features/session/SessionStartSheet'
import { LocaleSync } from '@/features/settings/LocaleSync'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pt-6 pb-[calc(112px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] keyboard:pb-[calc(8px+var(--vv-bottom,0px))]">
      <LocaleSync />
      <Outlet />
      <BottomNav />
      <SessionStartSheet />
      <ForgottenGuard />
    </div>
  )
}

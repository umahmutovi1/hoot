import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ForgottenGuard } from '@/features/session/ForgottenGuard'
import { SessionStartSheet } from '@/features/session/SessionStartSheet'
import { LocaleSync } from '@/features/settings/LocaleSync'
import { NavMenu } from './NavMenu'
import { TopBar } from './TopBar'

/**
 * Tab screens: the first row (avatar, AI, menu) and the screen below it. There is no bottom tab
 * bar (decision after v0.7.2, docs/design/NavMeni.html), so content runs to the bottom edge.
 */
export function AppShell() {
  const { pathname } = useLocation()
  // The menu is open on the page it was opened on; any navigation (also the avatar or AI inside
  // it) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const menuOpen = openOn === pathname
  const setMenuOpen = (open: boolean) => setOpenOn(open ? pathname : null)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-3 px-5 pt-[calc(24px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] keyboard:pb-[calc(8px+var(--vv-bottom,0px))]">
      <LocaleSync />
      <TopBar menuOpen={menuOpen} onMenu={() => setMenuOpen(true)} />
      <Outlet />
      <NavMenu open={menuOpen} onOpenChange={setMenuOpen} />
      <SessionStartSheet />
      <ForgottenGuard />
    </div>
  )
}

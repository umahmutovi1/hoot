import { useState } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Toast } from '@/components/Toast'
import { ImportJobBanner } from '@/features/owl/ImportJobBanner'
import { ContinueOnboarding } from '@/features/onboarding/ContinueOnboarding'
import { PendingSkipRunner } from '@/features/notify/PendingSkipRunner'
import { ForgottenGuard } from '@/features/session/ForgottenGuard'
import { SessionStartSheet } from '@/features/session/SessionStartSheet'
import { SearchPanel } from '@/features/search/SearchPanel'
import { LocaleSync } from '@/features/settings/LocaleSync'
import { ThemeSync } from '@/features/settings/ThemeSync'
import { Crumbs } from './Crumbs'
import { NavMenu } from './NavMenu'
import { TopBar } from './TopBar'

/**
 * Every screen except onboarding and the session flow: the sticky first row (logo, AI, menu), the
 * breadcrumbs with ‹ below the main screens, and the screen. There is no bottom tab bar
 * (decision after v0.7.2, docs/design/NavMeni.html), so content runs to the bottom edge.
 */
export function AppShell() {
  const { pathname } = useLocation()
  // The menu is open on the page it was opened on; any navigation (also the avatar or AI inside
  // it) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const menuOpen = openOn === pathname
  const setMenuOpen = (open: boolean) => setOpenOn(open ? pathname : null)
  const [searching, setSearching] = useState(false)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-3 px-5 pb-[calc(24px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] keyboard:pb-[calc(8px+var(--vv-bottom,0px))]">
      <LocaleSync />
      <ThemeSync />
      {/* Sticky: what scrolls under the row is blurred and fades out at its lower edge, so the
          logo, AI and ☰ stay legible on any content (design README, 10b). */}
      <div className="glass-bar sticky top-0 z-40 -mx-5 px-5 pt-[calc(24px+env(safe-area-inset-top))]">
        <TopBar
          menuOpen={menuOpen}
          onMenu={() => setMenuOpen(true)}
          onSearch={() => setSearching(true)}
        />
      </div>
      <Crumbs />
      <ContinueOnboarding />
      <Outlet />
      <NavMenu open={menuOpen} onOpenChange={setMenuOpen} onSearch={() => setSearching(true)} />
      <SearchPanel open={searching} onOpenChange={setSearching} />
      <SessionStartSheet />
      {/* Inside the router: applying a skip can start the next block (navigation). */}
      <PendingSkipRunner />
      <ForgottenGuard />
      <ImportJobBanner />
      <Toast />
      {/* A new screen starts at the top; back restores where you were. */}
      <ScrollRestoration />
    </div>
  )
}

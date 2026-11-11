import { useState } from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Celebration } from '@/components/Celebration'
import { PasswordPrompt } from '@/features/auth/PasswordSheet'
import { Toast } from '@/components/Toast'
import { ImportJobBanner } from '@/features/owl/ImportJobBanner'
import { ContinueOnboarding } from '@/features/onboarding/ContinueOnboarding'
import { PendingSkipRunner } from '@/features/notify/PendingSkipRunner'
import { ForgottenGuard } from '@/features/session/ForgottenGuard'
import { SessionStartSheet } from '@/features/session/SessionStartSheet'
import { SearchPanel } from '@/features/search/SearchPanel'
import { LocaleSync } from '@/features/settings/LocaleSync'
import { ThemeSync } from '@/features/settings/ThemeSync'
import { BottomNav } from './BottomNav'
import { HeaderSlotProvider, ScreenHeader } from './ScreenHeader'

/**
 * Every screen except onboarding and the session flow (Noćna sova, Sprint 19): the blue header with
 * the wave (the screen's title is portalled into it), the screen, and the bottom tab bar. A fixed
 * brand strip covers the status bar, so content scrolling under it stays out of the clock's way.
 */
export function AppShell() {
  const [searching, setSearching] = useState(false)
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  return (
    <HeaderSlotProvider value={slot}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-3 px-5 pb-[calc(112px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] keyboard:pb-[calc(8px+var(--vv-bottom,0px))]">
        <LocaleSync />
        <ThemeSync />
        <div
          aria-hidden="true"
          className="fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-brand"
        />
        <ScreenHeader onSearch={() => setSearching(true)} slotRef={setSlot} />
        <ContinueOnboarding />
        <Outlet />
        <BottomNav />
        <SearchPanel open={searching} onOpenChange={setSearching} />
        <SessionStartSheet />
        {/* Inside the router: applying a skip can start the next block (navigation). */}
        <PendingSkipRunner />
        <ForgottenGuard />
        <ImportJobBanner />
        <Toast />
        <Celebration />
        <PasswordPrompt />
        {/* A new screen starts at the top; back restores where you were. */}
        <ScrollRestoration />
      </div>
    </HeaderSlotProvider>
  )
}

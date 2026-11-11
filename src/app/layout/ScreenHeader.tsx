import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { goBack } from '@/app/navigation'
import { ChevronLeftIcon, GearIcon, SearchIcon } from '@/components/icons'
import { LogoMark } from '@/components/Logo'
import { useCrumbs } from './useCrumbs'

/** Where a screen's title goes: the element inside the blue header, once it has mounted. */
const HeaderSlot = createContext<HTMLElement | null>(null)
export const HeaderSlotProvider = HeaderSlot.Provider

/**
 * Renders a screen's title block inside the blue header (Noćna sova, Sprint 19). Outside the app
 * shell (or before the header mounts) it renders in place, so a screen still has its title.
 */
export function InHeader({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlot)
  return slot ? createPortal(children, slot) : children
}

/**
 * The blue header with the wave at the bottom (boards DanasA, Izgled). Main screens (no crumbs)
 * have the mark with "hoot" (home = Danas), search and settings as plain icons; screens below them
 * have ‹ with the parent's name instead. The screen's title is portalled into `slot`.
 */
export function ScreenHeader({
  onSearch,
  slotRef,
}: {
  onSearch: () => void
  slotRef: (el: HTMLDivElement | null) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const crumbs = useCrumbs()
  const parent = crumbs.at(-2)
  return (
    <header className="relative -mx-5 bg-brand px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-14 text-ground">
      <div className="flex h-12 items-center justify-between">
        {crumbs.length === 0 ? (
          <>
            <Link
              to="/"
              aria-label={t('nav.home')}
              className="flex h-11 items-center gap-2 font-display text-[22px] font-bold tracking-[-0.02em]"
            >
              <LogoMark />
              hoot
            </Link>
            <div className="-mr-2 flex">
              <button
                type="button"
                onClick={onSearch}
                aria-label={t('search.open')}
                className="flex size-11 items-center justify-center"
              >
                <SearchIcon size={22} />
              </button>
              <Link
                to="/settings"
                aria-label={t('menu.settings')}
                className="flex size-11 items-center justify-center"
              >
                <GearIcon size={21} />
              </Link>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => goBack(navigate, parent?.to ?? '/')}
            className="-ml-1 flex h-11 min-w-0 items-center gap-0.5 pr-2 text-[15px] font-semibold"
          >
            <ChevronLeftIcon size={22} className="shrink-0" />
            <span className="truncate">{parent?.label ?? t('app.back')}</span>
          </button>
        )}
      </div>
      <div ref={slotRef} className="mt-3 px-1 empty:hidden" />
      <svg
        viewBox="0 0 390 40"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-px block h-10 w-full text-ground"
      >
        <path
          d="M0 22 C 48 2, 104 2, 150 18 C 176 28, 214 28, 240 18 C 286 2, 342 2, 390 22 V40 H0 Z"
          fill="currentColor"
        />
      </svg>
    </header>
  )
}

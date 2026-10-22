import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dialog } from 'radix-ui'
import { ChevronDownIcon, SignOutIcon } from '@/components/icons'
import { signOut } from '@/features/auth/api'
import { useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { cn } from '@/lib/utils'
import { TopBar } from './TopBar'

interface Sub {
  to: string
  label: string
  dot?: string
}

interface Section {
  id: string
  label: string
  /** A section without subpages is a plain link. */
  to?: string
  subs?: Sub[]
  /** Routes that belong to the section (for the highlight and the open accordion). */
  match: (path: string) => boolean
}

/**
 * The menu (docs/design/NavMeni.html): the first row grows into a glass panel over the screen.
 * Main pages are plain text; pages with subpages open as an accordion (the section of the current
 * page starts open; opening another keeps it open). At the bottom only "Odjavi se". Closes on ×, a tap outside, Escape and on
 * every navigation.
 */
export function NavMenu({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="glass-sheet fixed inset-x-3 top-[calc(16px+env(safe-area-inset-top))] bottom-[calc(12px+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] z-50 mx-auto flex max-w-[406px] origin-top flex-col overflow-hidden rounded-[30px] duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98]"
        >
          <Dialog.Title className="sr-only">{t('menu.title')}</Dialog.Title>
          <div className="px-2 pt-2">
            <TopBar
              menuOpen
              onMenu={() => onOpenChange(false)}
              onLeave={() => onOpenChange(false)}
            />
          </div>
          <MenuBody onNavigate={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function MenuBody({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { data: subjects } = useSubjects()
  const active = (subjects ?? []).filter((s) => !s.archived)

  const sections: Section[] = [
    { id: 'today', label: t('nav.today'), to: '/', match: (p) => p === '/' },
    {
      id: 'plan',
      label: t('nav.plan'),
      match: (p) => p.startsWith('/plan'),
      subs: [
        { to: '/plan', label: t('menu.calendar') },
        { to: '/plan/availability', label: t('availability.title') },
        { to: '/plan/timetable', label: t('menu.timetable') },
      ],
    },
    {
      id: 'subjects',
      label: t('nav.subjects'),
      match: (p) => p.startsWith('/subjects'),
      subs: [
        ...active.map((s) => ({
          to: `/subjects/${s.id}`,
          label: s.name,
          dot: paletteOf(s.color).bar,
        })),
        { to: '/subjects', label: t('menu.allSubjects') },
      ],
    },
    {
      id: 'progress',
      label: t('nav.progress'),
      match: (p) => p.startsWith('/progress') || p.startsWith('/sessions'),
      subs: [
        { to: '/progress', label: t('menu.overview') },
        { to: '/sessions', label: t('menu.sessions') },
      ],
    },
    {
      id: 'settings',
      label: t('menu.settings'),
      match: (p) => p.startsWith('/settings'),
      subs: [
        { to: '/settings', label: t('menu.allSettings') },
        { to: '/settings/calendar', label: t('menu.academicCalendar') },
        { to: '/settings/feeds', label: t('feeds.title') },
        { to: '/settings/documents', label: t('menu.documents') },
      ],
    },
  ]
  const current = sections.find((s) => s.match(pathname))
  // Sections open independently; the current page's section starts open.
  const [expanded, setExpanded] = useState<string[]>(current?.subs ? [current.id] : [])

  return (
    <>
      <nav
        aria-label={t('nav.label')}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-3 pb-2"
      >
        {sections.map((s) => {
          const on = s === current
          const rowClass = cn(
            'flex h-12 w-full items-center justify-between rounded-[14px] px-2 text-[17px]',
            on ? 'font-semibold text-brand' : 'font-medium text-ink-secondary',
          )
          if (!s.subs)
            return (
              <Link
                key={s.id}
                to={s.to!}
                onClick={onNavigate}
                aria-current={on ? 'page' : undefined}
                className={rowClass}
              >
                {s.label}
              </Link>
            )
          const isOpen = expanded.includes(s.id)
          return (
            <div key={s.id} className="flex flex-col">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setExpanded(isOpen ? expanded.filter((id) => id !== s.id) : [...expanded, s.id])
                }
                className={rowClass}
              >
                {s.label}
                <ChevronDownIcon
                  size={18}
                  className={cn('text-ink-muted transition-transform', isOpen && 'rotate-180')}
                />
              </button>
              {isOpen && (
                <div className="flex flex-col pb-1.5 pl-5">
                  {s.subs.map((sub) => {
                    const here = pathname === sub.to
                    return (
                      <Link
                        key={sub.to}
                        to={sub.to}
                        onClick={onNavigate}
                        aria-current={here ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-2 border-l px-3 text-[15px]',
                          here
                            ? 'border-l-2 border-brand-accent font-semibold text-brand'
                            : 'border-hairline text-ink-muted',
                        )}
                      >
                        {sub.dot && (
                          <span className={cn('size-2 shrink-0 rounded-full', sub.dot)} />
                        )}
                        <span className="truncate">{sub.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="px-5 pt-2 pb-4">
        <button
          type="button"
          onClick={() => void signOut()}
          className="glass flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-danger"
        >
          <SignOutIcon size={18} />
          {t('settings.signOut')}
        </button>
      </div>
    </>
  )
}

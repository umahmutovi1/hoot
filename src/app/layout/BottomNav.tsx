import { useState, type ComponentType } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dialog } from 'radix-ui'
import {
  AiTabIcon,
  PlanTabIcon,
  ProgressTabIcon,
  SubjectsTabIcon,
  TodayTabIcon,
} from '@/components/icons'
import { useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { cn } from '@/lib/utils'

interface Sub {
  to: string
  label: string
  dot?: string
}
interface Tab {
  id: string
  to: string
  label: string
  Icon: ComponentType<{ size?: number }>
  match: (path: string) => boolean
  /** Subpages: a tap on the tab while it is active opens them (board Meni). */
  subs?: Sub[]
}

/**
 * Bottom tab bar (NavVarijante B, Sprint 19): full width, icon with the name under it. One pill
 * slides to the active tab (sky; amber on AI); no animation under reduced motion. Screens outside
 * the five tabs (Postavke) show no pill. Tapping the active tab again opens its subpages in a dark
 * menu above the bar; the ones without subpages just stay.
 */
export function BottomNav() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { data: subjects } = useSubjects()
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const tabs: Tab[] = [
    {
      id: 'today',
      to: '/',
      label: t('nav.today'),
      Icon: TodayTabIcon,
      match: (p) => p === '/' || p.startsWith('/today'),
    },
    {
      id: 'plan',
      to: '/plan',
      label: t('nav.plan'),
      Icon: PlanTabIcon,
      match: (p) => p.startsWith('/plan'),
      subs: [
        { to: '/plan', label: t('menu.calendar') },
        { to: '/plan/availability', label: t('availability.title') },
        { to: '/plan/timetable', label: t('menu.timetable') },
        { to: '/settings/feeds', label: t('feeds.title') },
      ],
    },
    {
      id: 'ai',
      to: '/chat',
      label: t('nav.ai'),
      Icon: AiTabIcon,
      match: (p) => p.startsWith('/chat'),
    },
    {
      id: 'subjects',
      to: '/subjects',
      label: t('nav.subjects'),
      Icon: SubjectsTabIcon,
      match: (p) => p.startsWith('/subjects'),
      subs: [
        ...(subjects ?? [])
          .filter((s) => !s.archived)
          .map((s) => ({ to: `/subjects/${s.id}`, label: s.name, dot: paletteOf(s.color).bar })),
        { to: '/subjects', label: t('menu.allSubjects') },
      ],
    },
    {
      id: 'progress',
      to: '/progress',
      label: t('nav.progress'),
      Icon: ProgressTabIcon,
      match: (p) => p.startsWith('/progress') || p.startsWith('/sessions'),
      subs: [
        { to: '/progress', label: t('menu.overview') },
        { to: '/progress/week', label: t('checkin.title') },
        { to: '/sessions', label: t('menu.sessions') },
      ],
    },
  ]
  const index = tabs.findIndex((tab) => tab.match(pathname))
  const menuTab = tabs.find((tab) => tab.id === menuFor)
  const menuIndex = tabs.findIndex((tab) => tab.id === menuFor)

  return (
    <>
      <nav
        aria-label={t('nav.label')}
        className="bottom-nav fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-[430px] grid-cols-5 px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] keyboard:hidden"
      >
        {index >= 0 && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-2 h-8 w-[60px] rounded-2xl transition-[left,background-color] duration-[320ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none',
              tabs[index]!.id === 'ai' ? 'bg-ai-soft' : 'bg-brand-soft',
            )}
            style={{ left: `calc(8px + (100% - 16px) / 5 * ${index + 0.5} - 30px)` }}
          />
        )}
        {tabs.map((tab, i) => {
          const on = i === index
          return (
            <Link
              key={tab.id}
              to={tab.to}
              aria-current={on ? 'page' : undefined}
              aria-haspopup={tab.subs ? 'menu' : undefined}
              onClick={(e) => {
                if (on && tab.subs) {
                  e.preventDefault()
                  setMenuFor(tab.id)
                }
              }}
              className={cn(
                'relative flex h-[60px] flex-col items-center gap-1 transition-colors',
                on ? 'text-ink' : tab.id === 'ai' ? 'text-ai-ink' : 'text-ink-secondary',
              )}
            >
              <span className="flex h-8 w-[60px] items-center justify-center">
                <tab.Icon size={24} />
              </span>
              <span className="text-[11px] font-bold tracking-[0.01em]">{tab.label}</span>
            </Link>
          )
        })}
      </nav>
      <Dialog.Root open={!!menuTab} onOpenChange={(open) => !open && setMenuFor(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex max-h-[60dvh] w-[260px] origin-bottom flex-col overflow-y-auto rounded-[28px] bg-ink p-2 text-ground shadow-[0_18px_40px_rgb(16_25_43/0.32)] duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            style={{
              left: `clamp(16px, calc(max(0px, (100vw - 430px) / 2) + 8px + (min(100vw, 430px) - 16px) / 5 * ${menuIndex + 0.5} - 130px), calc(100vw - 276px))`,
            }}
          >
            <Dialog.Title className="sr-only">{menuTab?.label}</Dialog.Title>
            {menuTab?.subs?.map((sub) => (
              <Link
                key={sub.to + sub.label}
                to={sub.to}
                onClick={() => setMenuFor(null)}
                aria-current={sub.to === pathname ? 'page' : undefined}
                className="flex h-14 shrink-0 items-center gap-3.5 rounded-[18px] px-3.5 text-base font-bold hover:bg-ground/8 aria-[current=page]:bg-ground/12"
              >
                {sub.dot && <span className={cn('size-2.5 shrink-0 rounded-full', sub.dot)} />}
                <span className="min-w-0 truncate">{sub.label}</span>
              </Link>
            ))}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

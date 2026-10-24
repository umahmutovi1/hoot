import { Link, useLocation, useNavigate } from 'react-router-dom'
import { goBack } from '@/app/navigation'
import { useTranslation } from 'react-i18next'
import { AiSparkIcon, CloseIcon, MenuIcon, SearchIcon } from '@/components/icons'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'

/** Faint glass pill behind the AI icon and the right-hand group (design README, 10b). */
const pill = 'rounded-full bg-white/30 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.6)]'

/**
 * First row of every screen (docs/design/NavMeni.html): the owl logo (home = Danas), the assistant
 * right next to it, and search with the menu on one pill in the corner. The AI spark is an icon on a faint pill; while the
 * chat is open it turns into the session purple (`glass-tint`) with a white icon and closes the
 * chat again. Inside the open menu the same row repeats with × in place of ☰, so nothing moves
 * when it opens; leaving through the logo or AI closes the menu too.
 */
export function TopBar({
  menuOpen,
  onMenu,
  onSearch,
  onLeave,
}: {
  menuOpen: boolean
  onMenu: () => void
  /** Opens the search panel (it sits on one pill with ☰). */
  onSearch: () => void
  /** Called before the logo or AI navigates away (closes the open menu). */
  onLeave?: () => void
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const inChat = pathname.startsWith('/chat')
  return (
    <div className="flex items-center gap-1">
      <Link
        to="/"
        onClick={onLeave}
        aria-label={t('nav.home')}
        className="flex size-11 shrink-0 items-center justify-center text-ink transition-transform active:scale-95"
      >
        <Logo size={34} />
      </Link>
      <button
        type="button"
        // A toggle: opens the assistant, and closes it again from the chat.
        onClick={() => {
          onLeave?.()
          if (inChat) goBack(navigate, '/')
          else navigate('/chat')
        }}
        aria-label={inChat ? t('nav.aiClose') : t('nav.aiLabel')}
        aria-pressed={inChat}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center transition-transform active:scale-95',
          inChat ? 'glass-tint rounded-full text-white' : cn(pill, 'text-brand-accent'),
        )}
      >
        <AiSparkIcon size={22} />
      </button>
      <span className="flex-1" />
      <div className={cn(pill, 'flex')}>
        <button
          type="button"
          onClick={onSearch}
          aria-label={t('search.open')}
          className="flex size-11 items-center justify-center text-ink"
        >
          <SearchIcon size={21} />
        </button>
        <button
          type="button"
          onClick={onMenu}
          aria-label={menuOpen ? t('menu.close') : t('menu.open')}
          aria-expanded={menuOpen}
          className="flex size-11 items-center justify-center text-ink"
        >
          {menuOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
        </button>
      </div>
    </div>
  )
}

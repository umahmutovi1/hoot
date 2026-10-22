import { Link, useLocation, useNavigate } from 'react-router-dom'
import { goBack } from '@/app/navigation'
import { useTranslation } from 'react-i18next'
import { AiSparkIcon, CloseIcon, MenuIcon } from '@/components/icons'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'

/**
 * First row of every screen (docs/design/NavMeni.html): the owl logo (home = Danas), the assistant
 * right next to it and the menu in the corner. No background of its own; "✦ AI" sits on a faint
 * glass pill so it reads as a button. It opens the chat and, while it is open (underlined), closes
 * it again. Inside the open menu the same row repeats with × in place of ☰, so nothing moves when
 * it opens; leaving through the logo or AI closes the menu too.
 */
export function TopBar({
  menuOpen,
  onMenu,
  onLeave,
}: {
  menuOpen: boolean
  onMenu: () => void
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
        className="relative flex h-11 items-center gap-1.5 rounded-full bg-white/30 px-3.5 text-[15px] font-semibold text-brand-accent shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.6)] transition-transform active:scale-95"
      >
        <AiSparkIcon size={22} />
        {t('nav.ai')}
        {inChat && (
          <span
            aria-hidden="true"
            className="absolute inset-x-3.5 bottom-1 h-0.5 rounded-full bg-brand-accent"
          />
        )}
      </button>
      <span className="flex-1" />
      <button
        type="button"
        onClick={onMenu}
        aria-label={menuOpen ? t('menu.close') : t('menu.open')}
        aria-expanded={menuOpen}
        className={cn('flex size-11 items-center justify-center text-ink')}
      >
        {menuOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
      </button>
    </div>
  )
}

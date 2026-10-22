import { useLocation, useNavigate } from 'react-router-dom'
import { goBack } from '@/app/navigation'
import { useTranslation } from 'react-i18next'
import { AiSparkIcon, CloseIcon, MenuIcon } from '@/components/icons'
import { ProfileButton } from '@/features/settings/ProfileButton'
import { cn } from '@/lib/utils'

/**
 * First row of every tab (docs/design/NavMeni.html): avatar, the assistant right next to it and
 * the menu in the corner. No background of its own; only the avatar has a fill. "✦ AI" opens the
 * chat and, while it is open (underlined), closes it again. Inside the open
 * menu the same row repeats with × in place of ☰, so nothing moves when it opens.
 */
export function TopBar({ menuOpen, onMenu }: { menuOpen: boolean; onMenu: () => void }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const inChat = pathname.startsWith('/chat')
  return (
    <div className="flex items-center gap-1">
      <ProfileButton />
      <button
        type="button"
        // A toggle: opens the assistant, and closes it again from the chat.
        onClick={() => (inChat ? goBack(navigate, '/') : navigate('/chat'))}
        aria-label={inChat ? t('nav.aiClose') : t('nav.aiLabel')}
        aria-pressed={inChat}
        className="relative flex h-11 items-center gap-1.5 px-2.5 text-[15px] font-semibold text-brand-accent transition-transform active:scale-95"
      >
        <AiSparkIcon size={22} />
        {t('nav.ai')}
        {inChat && (
          <span
            aria-hidden="true"
            className="absolute inset-x-2.5 bottom-1 h-0.5 rounded-full bg-brand-accent"
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

import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AiSparkIcon, CloseIcon, MenuIcon } from '@/components/icons'
import { ProfileButton } from '@/features/settings/ProfileButton'
import { cn } from '@/lib/utils'

/**
 * First row of every tab (docs/design/NavMeni.html): avatar, the assistant right next to it and
 * the menu in the corner. No background of its own; only the avatar has a fill. Inside the open
 * menu the same row repeats with × in place of ☰, so nothing moves when it opens.
 */
export function TopBar({ menuOpen, onMenu }: { menuOpen: boolean; onMenu: () => void }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const inChat = pathname.startsWith('/chat')
  return (
    <div className="flex items-center gap-1">
      <ProfileButton />
      <Link
        to="/chat"
        aria-label={t('nav.aiLabel')}
        aria-current={inChat ? 'page' : undefined}
        className="flex size-11 items-center justify-center text-brand-accent"
      >
        <AiSparkIcon size={23} />
      </Link>
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

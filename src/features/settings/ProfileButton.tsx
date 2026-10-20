import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/Avatar'
import { useProfile } from './profile'

/** Small avatar in the top-right corner of every tab screen; opens Postavke. */
export function ProfileButton() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  return (
    <Link
      to="/settings"
      aria-label={t('settings.open')}
      className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-full"
    >
      <Avatar name={profile?.display_name ?? ''} className="size-9 text-sm" />
    </Link>
  )
}

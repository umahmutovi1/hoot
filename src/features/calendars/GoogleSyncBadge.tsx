import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useGoogleSyncStatus } from './google'

/**
 * Next to the Plan title: is the plan in Google Calendar? A soft brand tag when it is (or is being
 * sent), a warning tag when not; a tap opens Povezani kalendari.
 */
export function GoogleSyncBadge() {
  const { t } = useTranslation()
  const { account, active, pending } = useGoogleSyncStatus()
  const state = !account
    ? 'off'
    : account.status === 'reconnect'
      ? 'reconnect'
      : !active
        ? 'off'
        : pending > 0
          ? 'pending'
          : 'synced'
  const warn = state === 'off' || state === 'reconnect'
  return (
    <Link
      to="/settings/feeds"
      className={cn(
        'flex min-h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold',
        warn ? 'bg-warning-soft text-warning-ink' : 'bg-brand-soft text-brand',
      )}
    >
      {t(`googleCalendar.badge.${state}`, { count: pending })}
    </Link>
  )
}

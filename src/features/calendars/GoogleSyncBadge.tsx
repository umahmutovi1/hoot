import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckIcon, ClockIcon, WarningIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { useGoogleSyncStatus } from './google'

/**
 * Plan header: is the plan in Google Calendar? "Google ✓", "Google · čeka 3", "Poveži ponovo" or
 * "Nije u Google-u"; a tap opens Povezani kalendari.
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
  const Icon = state === 'synced' ? CheckIcon : state === 'pending' ? ClockIcon : WarningIcon
  return (
    <Link
      to="/settings/feeds"
      className={cn(
        'flex h-11 items-center gap-1.5 rounded-full glass px-3.5 text-[13px] font-semibold',
        state === 'synced' && 'text-brand',
        state === 'pending' && 'text-ink-secondary',
        (state === 'off' || state === 'reconnect') && 'text-ink-muted',
        state === 'reconnect' && 'text-warning-ink',
      )}
    >
      <Icon size={16} />
      {t(`googleCalendar.badge.${state}`, { count: pending })}
    </Link>
  )
}

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNowStrict } from 'date-fns'
import { Switch } from '@/components/Switch'
import { useToast } from '@/components/toast-store'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import {
  connectGoogle,
  useDisconnectGoogle,
  useGoogleAccount,
  useGoogleCalendars,
  useGoogleSync,
  useSelectGoogleCalendar,
  useSetGooglePush,
} from './google'

/**
 * Google Calendar on Povezani kalendari (docs/CALENDAR-SYNC.md): connect with Google (no link to
 * paste), pick which calendars are busy time, show the plan in the "Hoot" calendar, disconnect.
 */
export function GoogleCalendarCard({ online }: { online: boolean }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const show = useToast((s) => s.show)
  const [params, setParams] = useSearchParams()
  const { data: account, isPending } = useGoogleAccount()
  const connected = Boolean(account)
  const calendars = useGoogleCalendars(connected && account?.status === 'active' && online)
  const select = useSelectGoogleCalendar()
  const setPush = useSetGooglePush()
  const sync = useGoogleSync()
  const disconnect = useDisconnectGoogle()
  const [connecting, setConnecting] = useState(false)
  const [confirm, setConfirm] = useState(false)

  // Back from Google's consent screen: ?google=connected | error | denied.
  const result = params.get('google')
  useEffect(() => {
    if (!result) return
    show(t(`googleCalendar.result.${result === 'connected' ? 'connected' : 'error'}`))
    setParams({}, { replace: true })
  }, [result, setParams, show, t])

  const connect = () => {
    setConnecting(true)
    connectGoogle().catch(() => {
      setConnecting(false)
      show(t('googleCalendar.result.error'))
    })
  }

  if (isPending) return null

  if (!account || account.status === 'reconnect')
    return (
      <div className="flex flex-col gap-3 rounded-card glass p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold">
            {account ? t('googleCalendar.reconnectTitle') : t('googleCalendar.title')}
          </span>
          <span className="text-[13px] leading-[1.45] text-ink-muted">
            {account ? t('googleCalendar.reconnectSub') : t('googleCalendar.sub')}
          </span>
        </div>
        <button
          type="button"
          onClick={connect}
          disabled={!online || connecting}
          className="btn-primary h-12 rounded-full text-[15px] font-semibold disabled:opacity-60"
        >
          {connecting ? t('googleCalendar.connecting') : t('googleCalendar.connect')}
        </button>
      </div>
    )

  const when = (iso: string | null) =>
    iso
      ? formatDistanceToNowStrict(new Date(iso), {
          addSuffix: true,
          locale: dateFnsLocales[locale],
        })
      : null
  const synced = when(account.last_pushed_at ?? account.last_synced_at)

  return (
    <div className="flex flex-col gap-3 rounded-card glass p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{t('googleCalendar.connectedTitle')}</span>
          <span className="truncate text-[13px] text-ink-muted">
            {[account.email, synced && t('feeds.synced', { when: synced })]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {account.last_error && (
            <span className="text-xs text-warning-ink">{t('googleCalendar.error')}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => sync.mutate()}
          disabled={!online || sync.isPending}
          className="flex h-11 shrink-0 items-center rounded-full bg-canvas px-3.5 text-[13px] font-semibold text-brand disabled:opacity-60"
        >
          {sync.isPending ? t('googleCalendar.syncing') : t('googleCalendar.syncNow')}
        </button>
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-sm font-semibold">{t('googleCalendar.push')}</span>
          <span className="text-xs text-ink-muted">{t('googleCalendar.pushSub')}</span>
        </span>
        <Switch
          checked={account.push_enabled}
          onChange={(enabled) => setPush.mutate({ id: account.id, enabled })}
          label={t('googleCalendar.push')}
          hideLabel
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-ink-secondary">
          {t('googleCalendar.busyTitle')}
        </span>
        <span className="text-xs leading-[1.45] text-ink-muted">{t('googleCalendar.busySub')}</span>
      </div>
      {calendars.isPending && (
        <span className="text-xs text-ink-muted">{t('googleCalendar.loading')}</span>
      )}
      {(calendars.data ?? []).map((c) => (
        <div key={c.id} className="flex min-h-11 items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full bg-ink-subtle"
              style={c.color ? { backgroundColor: c.color } : undefined}
            />
            <span className="truncate text-sm">
              {c.title}
              {c.primary && ` · ${t('googleCalendar.primary')}`}
            </span>
          </span>
          <Switch
            checked={c.busy}
            disabled={!online || select.isPending}
            onChange={(busy) => select.mutate({ calendar_id: c.id, busy })}
            label={c.title}
            hideLabel
          />
        </div>
      ))}

      {confirm ? (
        <div className="flex flex-col gap-2 rounded-[20px] bg-warning-soft p-4">
          <span className="text-sm text-warning-ink">{t('googleCalendar.disconnectConfirm')}</span>
          <button
            type="button"
            onClick={() => disconnect.mutate(true)}
            disabled={disconnect.isPending}
            className="h-11 rounded-full bg-white/70 text-sm font-semibold text-warning-ink"
          >
            {t('googleCalendar.disconnectDelete')}
          </button>
          <button
            type="button"
            onClick={() => disconnect.mutate(false)}
            disabled={disconnect.isPending}
            className="h-11 rounded-full bg-white/70 text-sm font-semibold"
          >
            {t('googleCalendar.disconnectKeep')}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="h-11 rounded-full text-sm font-semibold text-ink-muted"
          >
            {t('common.cancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="h-11 text-sm font-semibold text-warning-ink"
        >
          {t('googleCalendar.disconnect')}
        </button>
      )}
    </div>
  )
}

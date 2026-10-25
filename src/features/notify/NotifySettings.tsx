import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/Switch'
import { useToast } from '@/components/toast-store'
import { useProfile, useUpdateProfile } from '@/features/settings/profile'
import { formatClock } from '@/lib/schedule'
import { isIos } from './jobs'
import { OffsetChips } from './OffsetChips'
import { pushSupport, useDeviceEndpoint, usePushActions, useSubscriptions } from './api'

const row = 'flex items-center justify-between gap-3 border-b border-canvas py-2.5'

/**
 * Postavke → Notifikacije (Podsjetnici.dc.html 1): reminders before every block (offsets, Stage
 * 10c; "Kasniš 15 min" comes with them), end of a planned break, and Web Push on this device.
 * On iPhone it works only in the installed PWA, so that is said.
 */
export function NotifySettings() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const { data: device } = useDeviceEndpoint()
  const { data: subs = [] } = useSubscriptions()
  const actions = usePushActions()
  const toast = useToast((s) => s.show)
  const [busy, setBusy] = useState(false)
  const support = pushSupport()
  const on = Boolean(device && subs.some((s) => s.endpoint === device))

  const run = async (action: () => Promise<void>, done?: string) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
      if (done) toast(done)
    } catch {
      toast(t(pushSupport() === 'denied' ? 'notify.denied' : 'notify.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col rounded-card glass px-4 py-1.5">
      <div className="flex flex-col gap-2.5 border-b border-canvas py-3">
        <span className="flex flex-col">
          <span className="text-[15px]">{t('notify.reminders')}</span>
          <span className="text-xs text-ink-muted">{t('notify.remindersSub')}</span>
        </span>
        <OffsetChips
          value={profile?.reminder_offsets_min ?? [30]}
          onChange={(v) => update.mutate({ reminder_offsets_min: v })}
        />
      </div>
      <div className={row}>
        <span className="flex flex-col">
          <span className="text-[15px]">{t('notify.breakEnd')}</span>
          <span className="text-xs text-ink-muted">{t('notify.breakEndSub')}</span>
        </span>
        <Switch
          hideLabel
          label={t('notify.breakEnd')}
          checked={profile?.notify_break_end ?? true}
          onChange={(v) => update.mutate({ notify_break_end: v })}
        />
      </div>
      <span className="border-b border-canvas py-2.5 text-xs leading-[1.4] text-ink-muted">
        {profile?.sleep_min && profile.wake_min
          ? t('notify.remindersHint', {
              from: formatClock(profile.sleep_min[0]! % 1440),
              to: formatClock(profile.wake_min[0]! % 1440),
            })
          : t('notify.remindersHintNoRhythm')}
      </span>
      <div className="flex flex-col gap-2 py-3">
        {support === 'ok' && !on && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(actions.enable, t('notify.enabled'))}
            className="h-11 rounded-full btn-primary px-4 text-sm font-semibold disabled:opacity-60"
          >
            {t('notify.enable')}
          </button>
        )}
        {on && (
          <>
            <span className="text-[13px] text-success-ink">{t('notify.enabled')}</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => actions.test(t('notify.push.testTitle'), t('notify.push.testBody')),
                    t('notify.testSent'),
                  )
                }
                className="h-11 rounded-full bg-canvas px-4 text-sm font-semibold text-brand disabled:opacity-60"
              >
                {t('notify.test')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(actions.disable)}
                className="h-11 rounded-full px-3 text-sm font-semibold text-ink-secondary disabled:opacity-60"
              >
                {t('notify.disable')}
              </button>
            </div>
          </>
        )}
        {support === 'denied' && (
          <span className="text-[13px] text-warning-ink">{t('notify.denied')}</span>
        )}
        {support === 'unsupported' && (
          <span className="text-[13px] text-ink-muted">{t('notify.unsupported')}</span>
        )}
        {(support === 'ios_install' || isIos(navigator.userAgent, navigator.maxTouchPoints)) && (
          <span className="text-xs leading-[1.4] text-ink-muted">{t('notify.ios')}</span>
        )}
      </div>
    </div>
  )
}

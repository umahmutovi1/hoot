import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { Switch } from '@/components/Switch'
import { cn } from '@/lib/utils'
import { useAddFeed, useDeleteFeed, useUpdateFeed, type FeedRow } from './api'

const SERVICES = ['google', 'apple', 'outlook'] as const
type Service = (typeof SERVICES)[number]

/** A link the sync can fetch: https or webcal, nothing else. */
const isFeedUrl = (v: string) => /^(https?|webcal):\/\/[^\s/]+\.[^\s]+$/i.test(v.trim())

/**
 * DodajKalendar: a new feed (service, secret iCal link, switches) or an existing one (title,
 * switches, a new link, remove). The link is never shown again after saving, only its hint.
 */
export function FeedSheet({
  feed,
  onClose,
}: {
  feed: FeedRow | 'new' | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={feed !== null}
      onOpenChange={(o) => !o && onClose()}
      title={feed === 'new' ? t('feeds.newTitle') : (feed?.title ?? '')}
      subtitle={feed && feed !== 'new' ? (feed.url_hint ?? undefined) : t('feeds.newSub')}
    >
      {feed === 'new' && <NewFeedForm onDone={onClose} />}
      {feed && feed !== 'new' && <EditFeedForm key={feed.id} feed={feed} onDone={onClose} />}
    </BottomSheet>
  )
}

function NewFeedForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const add = useAddFeed()
  const [service, setService] = useState<Service>('google')
  const [url, setUrl] = useState('')
  const [busyOnly, setBusyOnly] = useState(true)
  const [allDay, setAllDay] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = isFeedUrl(url)

  const submit = async () => {
    if (!valid || add.isPending) return
    setError(null)
    try {
      const result = await add.mutateAsync({
        title: t(`feeds.service.${service}`),
        url: url.trim(),
        kind: 'busy',
        busy_only: busyOnly,
        all_day_busy: allDay,
      })
      const failed = result?.results.find((r) => r.error)
      // The feed is saved either way; a sync error shows on its row.
      if (failed?.error) setError(t(`feeds.error.${failed.error}`))
      else onDone()
    } catch {
      setError(t('feeds.error.save_failed'))
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div
        role="radiogroup"
        aria-label={t('feeds.serviceLabel')}
        className="flex flex-wrap gap-1.5"
      >
        {SERVICES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={service === s}
            onClick={() => setService(s)}
            className={cn(
              'h-11 rounded-full px-4 text-[13px] font-semibold',
              service === s ? 'bg-ink text-white' : 'bg-white/50 text-ink',
            )}
          >
            {t(`feeds.service.${s}`)}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-secondary">{t('feeds.link')}</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="https://calendar.google.com/…/basic.ics"
          className="h-12 rounded-input bg-canvas px-4 text-[15px] outline-none"
        />
        <span className="text-xs leading-[1.45] text-ink-muted">{t(`feeds.howto.${service}`)}</span>
      </label>
      <SwitchRow
        checked={busyOnly}
        onChange={setBusyOnly}
        title={t('feeds.busyOnly')}
        sub={t('feeds.busyOnlySub')}
      />
      <SwitchRow
        checked={allDay}
        onChange={setAllDay}
        title={t('feeds.allDay')}
        sub={t('feeds.allDaySub')}
      />
      <p className="text-xs leading-[1.45] text-ink-muted">{t('feeds.secret')}</p>
      {error && <p className="text-sm text-warning-ink">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!valid || add.isPending}
        className="btn-primary h-14 rounded-full text-base font-semibold"
      >
        {add.isPending ? t('feeds.adding') : t('feeds.addButton')}
      </button>
    </div>
  )
}

function EditFeedForm({ feed, onDone }: { feed: FeedRow; onDone: () => void }) {
  const { t } = useTranslation()
  const update = useUpdateFeed()
  const remove = useDeleteFeed()
  const [title, setTitle] = useState(feed.title)
  const [url, setUrl] = useState('')
  const [confirm, setConfirm] = useState(false)

  const save = () => {
    const patch: Parameters<typeof update.mutate>[0]['patch'] = {}
    if (title.trim() && title.trim() !== feed.title) patch.title = title.trim()
    if (url.trim()) patch.url = url.trim()
    if (Object.keys(patch).length > 0) update.mutate({ id: feed.id, patch })
    onDone()
  }

  return (
    <div className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-secondary">{t('feeds.name')}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className="h-12 rounded-input bg-canvas px-4 text-[15px] outline-none"
        />
      </label>
      <SwitchRow
        checked={feed.busy_only}
        onChange={(v) => update.mutate({ id: feed.id, patch: { busy_only: v } })}
        title={t('feeds.busyOnly')}
        sub={t('feeds.busyOnlySub')}
      />
      <SwitchRow
        checked={feed.all_day_busy}
        onChange={(v) => update.mutate({ id: feed.id, patch: { all_day_busy: v } })}
        title={t('feeds.allDay')}
        sub={t('feeds.allDaySub')}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-secondary">{t('feeds.newLink')}</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={t('feeds.newLinkPlaceholder')}
          className="h-12 rounded-input bg-canvas px-4 text-[15px] outline-none"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={url.trim() !== '' && !isFeedUrl(url)}
        className="btn-primary h-14 rounded-full text-base font-semibold"
      >
        {t('common.save')}
      </button>
      {confirm ? (
        <div className="flex flex-col gap-2 rounded-[20px] bg-warning-soft p-4">
          <span className="text-sm text-warning-ink">{t('feeds.removeConfirm')}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="h-11 flex-1 rounded-full glass text-sm font-semibold"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                remove.mutate(feed.id)
                onDone()
              }}
              className="h-11 flex-1 rounded-full bg-warning text-sm font-semibold text-white"
            >
              {t('feeds.remove')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="h-12 rounded-full bg-canvas text-[15px] font-semibold text-danger"
        >
          {t('feeds.remove')}
        </button>
      )}
    </div>
  )
}

function SwitchRow({
  checked,
  onChange,
  title,
  sub,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  sub: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px]">{title}</span>
        <span className="text-xs text-ink-muted">{sub}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={title} hideLabel />
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNowStrict } from 'date-fns'
import { BackHeader } from '@/components/BackHeader'
import { ChevronRightIcon, PlusIcon } from '@/components/icons'
import { OfflineNotice } from '@/components/OfflineNotice'
import { useOnline } from '@/features/owl/api'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useCalendarFeeds, type FeedRow } from './api'
import { FeedSheet } from './FeedSheet'

/** Postavke → Povezani kalendari (PovezaniKalendari mockup): feeds, status, add. */
export function CalendarFeedsPage() {
  const { t } = useTranslation()
  const online = useOnline()
  const { data: feeds, isPending } = useCalendarFeeds()
  const [sheet, setSheet] = useState<FeedRow | 'new' | null>(null)

  return (
    <div className="flex flex-col gap-3.5">
      <BackHeader title={t('feeds.title')} fallback="/settings" />
      <p className="px-1 text-sm leading-[1.45] text-ink-secondary">{t('feeds.intro')}</p>
      {!online && <OfflineNotice />}

      {!isPending && (feeds ?? []).length > 0 && (
        <div className="flex flex-col rounded-card glass px-4 py-1">
          {(feeds ?? []).map((f, i) => (
            <FeedRowButton
              key={f.id}
              feed={f}
              last={i === (feeds ?? []).length - 1}
              onOpen={() => setSheet(f)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setSheet('new')}
        disabled={!online}
        className="flex h-[52px] items-center justify-center gap-1.5 rounded-full glass text-[15px] font-semibold text-brand disabled:opacity-60"
      >
        <PlusIcon size={18} />
        {t('feeds.add')}
      </button>

      <FeedSheet feed={sheet} onClose={() => setSheet(null)} />
    </div>
  )
}

function FeedRowButton({
  feed,
  last,
  onOpen,
}: {
  feed: FeedRow
  last: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const synced = feed.last_synced_at
    ? formatDistanceToNowStrict(new Date(feed.last_synced_at), {
        addSuffix: true,
        locale: dateFnsLocales[locale],
      })
    : null
  const status = feed.last_error
    ? null
    : synced
      ? t('feeds.synced', { when: synced })
      : t('feeds.notSynced')
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex min-h-16 items-center gap-3 py-3 text-left',
        !last && 'border-b border-canvas',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{feed.title}</span>
        {status && (
          <span className="truncate text-xs text-ink-muted">
            {status}
            {feed.busy_only && ` · ${t('feeds.busyOnlyShort')}`}
          </span>
        )}
        {feed.last_error && (
          <span className="text-xs text-warning-ink">
            {t(`feeds.error.${feed.last_error as 'fetch_failed'}`)}
          </span>
        )}
      </span>
      <span className="rounded-lg bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand">
        {t(`feeds.kind.${feed.kind as 'busy'}`)}
      </span>
      <ChevronRightIcon size={16} className="text-ink-muted" />
    </button>
  )
}

import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import type { DayBusy } from '@/features/plan/agenda'
import { formatClock } from '@/lib/schedule'
import { EVENT_KINDS } from '@/lib/calendar/classify'
import { cn } from '@/lib/utils'
import { useIgnoreEvent, useSetEventKind } from './api'

/** A busy event from a connected calendar: where it comes from, and "Ignoriši" / "Vrati". */
export function BusySheet({ item, onClose }: { item: DayBusy | null; onClose: () => void }) {
  const { t } = useTranslation()
  const ignore = useIgnoreEvent()
  const setKind = useSetEventKind()
  return (
    <BottomSheet
      open={item !== null}
      onOpenChange={(o) => !o && onClose()}
      title={item?.title ?? t('feeds.busy')}
      subtitle={
        item
          ? `${formatClock(item.startMin)} – ${formatClock(item.endMin)} · ${item.google ? t('googleCalendar.fromGoogle', { source: item.source }) : t('feeds.fromSource', { source: item.source })}`
          : undefined
      }
    >
      {item && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-secondary">
              {t('feeds.kindOf.title')}
            </span>
            <div
              role="radiogroup"
              aria-label={t('feeds.kindOf.title')}
              className="flex flex-wrap gap-1.5"
            >
              {EVENT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={item.kind === k}
                  onClick={() => {
                    if (k === item.kind) return
                    setKind.mutate({ id: item.eventId, kind: k })
                    // A due date or a free event leaves the time axis.
                    if (k === 'deadline' || k === 'free') onClose()
                  }}
                  className={cn(
                    'h-11 rounded-full px-4 text-[13px] font-semibold',
                    item.kind === k ? 'bg-ink text-white' : 'bg-white/50 text-ink',
                  )}
                >
                  {t(`feeds.kindOf.${k}`)}
                </button>
              ))}
            </div>
            <span className="text-xs leading-[1.45] text-ink-muted">
              {t(`feeds.kindOf.hint.${item.kind}`)}
            </span>
          </div>
          <p className="text-sm leading-[1.45] text-ink-secondary">
            {item.ignored ? t('feeds.ignoredHint') : t('feeds.busyHint')}
          </p>
          <button
            type="button"
            onClick={() => {
              ignore.mutate({ id: item.eventId, ignored: !item.ignored })
              onClose()
            }}
            className="btn-primary h-14 rounded-full text-base font-semibold"
          >
            {item.ignored ? t('feeds.unignore') : t('feeds.ignore')}
          </button>
        </div>
      )}
    </BottomSheet>
  )
}

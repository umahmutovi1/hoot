import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import type { DayBusy } from '@/features/plan/agenda'
import { formatClock } from '@/lib/schedule'
import { useIgnoreEvent } from './api'

/** A busy event from a connected calendar: where it comes from, and "Ignoriši" / "Vrati". */
export function BusySheet({ item, onClose }: { item: DayBusy | null; onClose: () => void }) {
  const { t } = useTranslation()
  const ignore = useIgnoreEvent()
  return (
    <BottomSheet
      open={item !== null}
      onOpenChange={(o) => !o && onClose()}
      title={item?.title ?? t('feeds.busy')}
      subtitle={
        item
          ? `${formatClock(item.startMin)} – ${formatClock(item.endMin)} · ${t('feeds.fromSource', { source: item.source })}`
          : undefined
      }
    >
      {item && (
        <div className="flex flex-col gap-3">
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

import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { LockIcon } from '@/components/icons'
import { formatClock } from '@/lib/schedule'
import type { DayBlockView } from './useDayBlocks'

/**
 * "Vrati predloženi plan" (Uredi dan): a preview first. The blocks of the day that were moved and
 * became Fixed are listed with their current time; on confirm they go back to the plan, which
 * places their material again (with undo in the toast).
 */
export function RestorePlanSheet({
  open,
  onOpenChange,
  blocks,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  blocks: DayBlockView[]
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('plan.restore.title')}
      subtitle={t('plan.restore.lead')}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col rounded-[20px] bg-white/50 px-3.5">
          {blocks.map((b, i) => (
            <div
              key={b.block.id}
              className={`flex flex-col gap-0.5 py-3 ${i < blocks.length - 1 ? 'border-b border-canvas' : ''}`}
            >
              <span className="text-sm leading-snug font-semibold">{b.title}</span>
              <span className="flex items-center gap-1 text-xs text-ink-muted">
                {b.startMin !== null &&
                  `${formatClock(b.startMin)}–${formatClock(b.startMin + b.block.planned_minutes)} · `}
                <LockIcon size={11} className="shrink-0" />
                {t('plan.restore.change')}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false)
            onConfirm()
          }}
          className="btn-primary h-14 rounded-full text-base font-semibold"
        >
          {t('plan.restore.confirm', { count: blocks.length })}
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="h-12 rounded-full text-[15px] font-semibold text-ink-muted"
        >
          {t('common.cancel')}
        </button>
      </div>
    </BottomSheet>
  )
}

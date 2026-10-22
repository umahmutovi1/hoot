import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlusIcon } from '@/components/icons'
import { useToast } from '@/components/toast-store'
import { useDayBoundary } from '@/features/settings/profile'
import { localDay, toDisplayDate, wallClock } from '@/lib/day'
import { formatClock } from '@/lib/schedule'
import { useDeleteBlock } from './actions'
import { useAgenda } from './agenda'
import { BlockSheet } from './BlockSheet'
import { DayStrip } from './DayStrip'
import { DayTimeline } from './DayTimeline'
import type { PlanBlockRow } from './state'
import { toTimeline, useDayBlocks } from './useDayBlocks'

/**
 * Plan → Satnica: the day's blocks at the times `placeTimes()` gave them, around classes and
 * calendar busy time. Changing a block (time, day, length) makes it manual; "Vrati predloženo"
 * drops the day's changed AI blocks so the plan places that material again.
 */
export function ScheduleView() {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const [now] = useState(() => new Date())
  const todayDate = localDay(now, boundary)
  const [selected, setSelected] = useState(() => toDisplayDate(todayDate))
  const date = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`
  const agenda = useAgenda()
  const { blocksFor } = useDayBlocks()
  const blocks = blocksFor(date)
  const remove = useDeleteBlock()
  const show = useToast((s) => s.show)
  const [sheet, setSheet] = useState<{ open: boolean; block: PlanBlockRow | null }>({
    open: false,
    block: null,
  })
  const edited = blocks.filter((b) => b.edited && b.block.status === 'planned')
  const untimed = blocks.filter((b) => b.startMin === null)

  const revert = async () => {
    const undos: (() => Promise<void>)[] = []
    for (const b of edited) undos.push(await remove(b.block, false))
    show(t('plan.schedule.reverted'), {
      label: t('today.cant.undo'),
      run: () => void Promise.all(undos.map((u) => u())),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <DayStrip selected={selected} today={toDisplayDate(todayDate)} onSelect={setSelected} />
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-xs leading-[1.4] text-ink-muted">
          {t('plan.schedule.note')} · {t('plan.schedule.moved')}
        </span>
        {edited.length > 0 && (
          <button
            type="button"
            onClick={() => void revert()}
            className="flex h-9 shrink-0 items-center rounded-full bg-canvas px-3 text-[13px] font-semibold text-brand"
          >
            {t('plan.schedule.revert')}
          </button>
        )}
      </div>
      <div className="rounded-card-lg glass p-3 pr-2">
        {blocks.length === 0 && (
          <p className="px-1 pb-2 text-sm text-ink-muted">{t('plan.schedule.empty')}</p>
        )}
        <DayTimeline
          items={agenda.classesFor(date)}
          busy={agenda.busyFor(date)}
          blocks={toTimeline(blocks)}
          onPickBlock={(b) => setSheet({ open: true, block: b.block })}
          nowMin={date === todayDate ? wallClock(now, boundary.timeZone).minutes : undefined}
        />
      </div>
      {untimed.map((b) => (
        <button
          key={b.block.id}
          type="button"
          onClick={() => setSheet({ open: true, block: b.block })}
          className="flex items-center justify-between gap-3 rounded-[20px] glass px-4 py-3.5 text-left"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold">{b.title}</span>
            <span className="truncate text-xs text-ink-muted">{b.sub}</span>
          </span>
          <span className="shrink-0 text-xs text-ink-muted">
            {b.startMin === null ? t('plan.schedule.noTime') : formatClock(b.startMin)}
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => setSheet({ open: true, block: null })}
        className="flex h-[52px] items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-line text-[15px] font-semibold"
      >
        <PlusIcon size={16} className="text-brand" />
        {t('blockSheet.add')}
      </button>
      <BlockSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        block={sheet.block}
        date={date}
        today={todayDate}
      />
    </div>
  )
}

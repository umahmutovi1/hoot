import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { CircleMinusIcon, PencilIcon, SkipIcon, TrashIcon } from '@/components/icons'
import { useToast } from '@/components/toast-store'
import { useDeleteBlock, useStartBlock } from '@/features/plan/actions'
import { blockMode, blockPages, blockTitle, useGoalTitle } from '@/features/plan/model'
import type { PlanBlockRow } from '@/features/plan/state'
import { presetName, usePresets } from '@/features/session/presets'
import { formatDuration } from '@/features/sources/format'
import { useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { formatClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import type { PlanToday } from './usePlanToday'

const secondary =
  'flex h-16 flex-1 flex-col items-center justify-center gap-1 rounded-[20px] bg-white/55 text-[13px] font-semibold shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.7),inset_0_1px_1px_rgba(255,255,255,0.9)]'

/**
 * "Započeti sesiju sada?" (StartSesije.dc.html, PRD "Blok na listi Danas"): a tap on a block in
 * the Danas list asks before starting. Počni is the same start as on "Sljedeće"; below are Uredi,
 * Preskoči and, by origin, "Izbaci iz plana" (AI block: the delete question from Plan) or "Obriši"
 * (manual block: at once, with undo).
 */
export function BlockStartSheet({
  block,
  plan,
  canStart,
  onClose,
  onEdit,
  onSkip,
  onDrop,
}: {
  block: PlanBlockRow | null
  plan: PlanToday
  /** False while another session runs: the block can still be edited or skipped. */
  canStart: boolean
  onClose: () => void
  onEdit: (block: PlanBlockRow) => void
  onSkip: (block: PlanBlockRow) => void
  onDrop: (block: PlanBlockRow) => void
}) {
  const { t } = useTranslation()
  // Keep the last block while the sheet slides out.
  const [shown, setShown] = useState(block)
  if (block && block !== shown) setShown(block)
  return (
    <BottomSheet
      open={block !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t('today.start.title')}
    >
      {shown && (
        <Body
          block={shown}
          plan={plan}
          canStart={canStart}
          onClose={onClose}
          onEdit={onEdit}
          onSkip={onSkip}
          onDrop={onDrop}
        />
      )}
    </BottomSheet>
  )
}

function Body({
  block,
  plan,
  canStart,
  onClose,
  onEdit,
  onSkip,
  onDrop,
}: {
  block: PlanBlockRow
  plan: PlanToday
  canStart: boolean
  onClose: () => void
  onEdit: (block: PlanBlockRow) => void
  onSkip: (block: PlanBlockRow) => void
  onDrop: (block: PlanBlockRow) => void
}) {
  const { t } = useTranslation()
  const { data: subjects = [] } = useSubjects()
  const goalTitle = useGoalTitle()
  const start = useStartBlock()
  const remove = useDeleteBlock()
  const show = useToast((s) => s.show)
  const { resolve, suggestedId } = usePresets()
  const [busy, setBusy] = useState(false)
  const subject = subjects.find((s) => s.id === block.subject_id)
  const manual = block.origin === 'user'
  const mode = block.kind === 'learn' ? blockMode(block, plan.units) : block.kind
  const meta = [
    block.start_min === null
      ? null
      : `${formatClock(block.start_min)}–${formatClock(block.start_min + block.planned_minutes)}`,
    formatDuration(t, block.planned_minutes),
    blockPages(t, block, plan.units),
  ]
    .filter(Boolean)
    .join(' · ')

  const deleteNow = async () => {
    onClose()
    const undo = await remove(block, false)
    show(t('blockSheet.deletedToast'), { label: t('today.cant.undo'), run: () => void undo() })
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="glass flex flex-col gap-1.5 rounded-[22px] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span
            className={cn('size-2.5 shrink-0 rounded-full', paletteOf(subject?.color ?? null).bar)}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-secondary">
            {subject?.name}
          </span>
          {manual && <span className="text-xs text-ink-muted">{t('planBlocks.manual')}</span>}
          <span className="flex h-6 shrink-0 items-center rounded-full bg-brand-soft px-2.5 text-xs font-semibold text-brand-strong">
            {t(`planBlocks.mode.${mode}`)}
          </span>
        </div>
        <span className="text-xl font-semibold tracking-[-0.4px]">
          {blockTitle(t, block, plan.units, goalTitle(block.deadline_id ?? ''))}
        </span>
        <span className="text-[13px] text-ink-secondary">{meta}</span>
        <span className="text-[13px] text-ink-muted">
          {t('today.start.pauses', { preset: presetName(t, resolve(suggestedId)) })}
        </span>
      </div>
      {canStart && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void start(block, plan.units).finally(() => setBusy(false))
          }}
          className="btn-primary flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold"
        >
          <PlayIcon />
          {t('today.start.begin')}
        </button>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => onEdit(block)} className={secondary}>
          <PencilIcon size={18} className="text-brand" />
          {t('today.start.edit')}
        </button>
        <button type="button" onClick={() => onSkip(block)} className={secondary}>
          <SkipIcon size={18} className="text-brand" />
          {t('today.start.skip')}
        </button>
        {manual ? (
          <button
            type="button"
            onClick={() => void deleteNow()}
            className={cn(secondary, 'text-danger')}
          >
            <TrashIcon size={18} />
            {t('today.start.delete')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDrop(block)}
            className={cn(secondary, 'text-danger')}
          >
            <CircleMinusIcon size={18} />
            {t('today.start.drop')}
          </button>
        )}
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5v14l12-7z" />
    </svg>
  )
}

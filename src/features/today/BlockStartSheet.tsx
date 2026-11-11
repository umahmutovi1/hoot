import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { useToast } from '@/components/toast-store'
import { useDeleteBlock, useStartBlock } from '@/features/plan/actions'
import { blockMode, blockPages, blockTitle, useGoalTitle } from '@/features/plan/model'
import type { PlanBlockRow } from '@/features/plan/state'
import { usePresets } from '@/features/session/presets'
import { RhythmRow } from '@/features/session/RhythmRow'
import { formatDuration } from '@/features/sources/format'
import { useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { formatClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import type { PlanToday } from './usePlanToday'

const secondary =
  'flex h-12 flex-1 items-center justify-center text-[15px] font-bold text-brand-strong'

/**
 * "Započeti sesiju sada?" (StartSesije.dc.html, PRD "Blok na listi Danas"): a tap on a block in
 * the Danas list asks before starting. Počni is the same start as on "Sljedeće"; below are Uredi,
 * Preskoči and, by origin, "Izbaci iz plana" (AI block: the delete question from Plan) or "Obriši"
 * (manual block: at once, with undo). "Odradila sam bez timera" closes it with a manual session.
 */
export function BlockStartSheet({
  block,
  plan,
  canStart,
  onClose,
  onEdit,
  onSkip,
  onDrop,
  onNoTimer,
}: {
  block: PlanBlockRow | null
  plan: PlanToday
  /** False while another session runs: the block can still be edited or skipped. */
  canStart: boolean
  onClose: () => void
  onEdit: (block: PlanBlockRow) => void
  onSkip: (block: PlanBlockRow) => void
  onDrop: (block: PlanBlockRow) => void
  onNoTimer: (block: PlanBlockRow) => void
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
          onNoTimer={onNoTimer}
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
  onNoTimer,
}: {
  block: PlanBlockRow
  plan: PlanToday
  canStart: boolean
  onClose: () => void
  onEdit: (block: PlanBlockRow) => void
  onSkip: (block: PlanBlockRow) => void
  onDrop: (block: PlanBlockRow) => void
  onNoTimer: (block: PlanBlockRow) => void
}) {
  const { t } = useTranslation()
  const { data: subjects = [] } = useSubjects()
  const goalTitle = useGoalTitle()
  const start = useStartBlock()
  const remove = useDeleteBlock()
  const show = useToast((s) => s.show)
  const { suggestedId } = usePresets()
  // The default rhythm, read-only until "Promijeni" (PRD "Dopune, 5. nov 2026").
  const [presetId, setPresetId] = useState<string | null>(null)
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
      <div className="surface flex flex-col gap-1.5 rounded-[22px] px-4 py-3.5">
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
      </div>
      <RhythmRow
        value={presetId ?? suggestedId}
        onChange={setPresetId}
        sub={presetId ? undefined : t('today.start.rhythmSub')}
      />
      {canStart && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void start(block, plan.units, { timerMode: presetId ?? suggestedId }).finally(() =>
              setBusy(false),
            )
          }}
          className="btn-primary flex h-14 items-center justify-center gap-2.5 rounded-[18px] text-[17px] font-bold"
        >
          <PlayIcon />
          {t('today.start.begin')}
        </button>
      )}
      <div className="-mt-1 flex gap-1">
        <button type="button" onClick={() => onEdit(block)} className={secondary}>
          {t('today.start.edit')}
        </button>
        <button type="button" onClick={() => onSkip(block)} className={secondary}>
          {t('today.start.skip')}
        </button>
        {manual ? (
          <button
            type="button"
            onClick={() => void deleteNow()}
            className={cn(secondary, 'text-danger')}
          >
            {t('today.start.delete')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDrop(block)}
            className={cn(secondary, 'text-danger')}
          >
            {t('today.start.drop')}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onNoTimer(block)}
        className="-mt-1 flex h-11 items-center justify-center text-[15px] font-semibold text-brand"
      >
        {t('today.noTimer.link')}
      </button>
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

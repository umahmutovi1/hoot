import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { blockMode, blockTitle } from '@/features/plan/model'
import type { PlanBlockRow } from '@/features/plan/state'
import { useSessionWriter } from '@/features/session/api'
import { Chip } from '@/features/session/Chip'
import { useDayBoundary } from '@/features/settings/profile'
import { formatDuration } from '@/features/sources/format'
import { useSubjects } from '@/features/subjects/api'
import { MINUTE } from '@/lib/session/timer'
import { zonedInstant } from '@/lib/day'
import type { PlanToday } from './usePlanToday'

const OPTIONS = [30, 45, 60, 90]

/**
 * "Odradila sam bez timera" (decision, Stage 10b): a block studied without the timer becomes a
 * manual session tied to it, so the block is done and its material counts as covered. The usual
 * end form follows (how far, difficulty); manual sessions never feed the calibration.
 */
export function DoneWithoutTimerSheet({
  block,
  plan,
  onClose,
}: {
  block: PlanBlockRow | null
  plan: PlanToday
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(block)
  if (block && block !== shown) setShown(block)
  return (
    <BottomSheet
      open={block !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t('today.noTimer.title')}
    >
      {shown && <Body key={shown.id} block={shown} plan={plan} onClose={onClose} />}
    </BottomSheet>
  )
}

function Body({
  block,
  plan,
  onClose,
}: {
  block: PlanBlockRow
  plan: PlanToday
  onClose: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const writer = useSessionWriter()
  const boundary = useDayBoundary()
  const { data: subjects = [] } = useSubjects()
  const [minutes, setMinutes] = useState(block.planned_minutes)
  const [busy, setBusy] = useState(false)
  const options = [...new Set([block.planned_minutes, ...OPTIONS])].sort((a, b) => a - b)
  const subject = subjects.find((s) => s.id === block.subject_id)

  const save = async () => {
    setBusy(true)
    // It ends when the block would have ended, never in the future.
    const planEnd =
      block.start_min === null
        ? null
        : zonedInstant(block.on_date, block.start_min + block.planned_minutes, boundary.timeZone)
    const end = new Date(Math.min(Date.now(), planEnd?.getTime() ?? Date.now()))
    const id = await writer.addManual({
      subjectId: block.subject_id,
      mode: blockMode(block, plan.units),
      start: new Date(end.getTime() - minutes * MINUTE),
      end,
      blockId: block.id,
      unitId: block.plan_block_units[0]?.unit_id ?? null,
    })
    onClose()
    setBusy(false)
    navigate(`/session/${id}/end`)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[15px] leading-[1.45] text-ink-secondary">
        {t('today.noTimer.body', {
          title: `${subject?.name ?? ''} · ${blockTitle(t, block, plan.units)}`,
        })}
      </p>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold tracking-[0.3px] text-ink-secondary uppercase">
          {t('today.noTimer.howLong')}
        </span>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {options.map((m) => (
            <Chip key={m} selected={m === minutes} onClick={() => setMinutes(m)}>
              {formatDuration(t, m)}
            </Chip>
          ))}
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="btn-primary flex h-14 items-center justify-center rounded-full text-base font-semibold"
      >
        {t('today.noTimer.next')}
      </button>
    </div>
  )
}

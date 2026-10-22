import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { useSkipBlock } from '@/features/plan/actions'
import { blockTitle, useGoalTitle } from '@/features/plan/model'
import type { PlanBlockRow } from '@/features/plan/state'
import { useSubjects } from '@/features/subjects/api'
import type { PlanToday } from './usePlanToday'

/**
 * "Preskoči" (decision after 8b): skip this block and, if there is one, start the next block of
 * today right away (the day is pulled earlier); the skipped material keeps its place in the plan.
 */
export function SkipSheet({
  block,
  plan,
  onClose,
}: {
  block: PlanBlockRow | null
  plan: PlanToday
  onClose: () => void
}) {
  const { t } = useTranslation()
  const skip = useSkipBlock()
  const goalTitle = useGoalTitle()
  const { data: subjects = [] } = useSubjects()
  const [busy, setBusy] = useState(false)
  const title = (b: PlanBlockRow) =>
    `${(subjects.find((s) => s.id === b.subject_id)?.name ?? '').split(' ')[0]} — ${blockTitle(t, b, plan.units, goalTitle(b.deadline_id ?? ''))}`
  const next = block
    ? plan.todayBlocks
        .filter(
          (b) =>
            b.id !== block.id &&
            b.status === 'planned' &&
            b.start_min !== null &&
            b.start_min + b.planned_minutes > plan.nowMin,
        )
        .sort((a, b) => a.start_min! - b.start_min!)[0]
    : undefined

  const run = async (startNext: boolean) => {
    if (!block || busy) return
    setBusy(true)
    try {
      onClose()
      await skip(block, plan.units, startNext)
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      open={block !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t('today.skip.title')}
      subtitle={block ? title(block) : undefined}
    >
      <p className="-mt-1 text-[15px] leading-[1.45] text-ink-secondary">{t('today.skip.body')}</p>
      <div className="flex flex-col gap-2">
        {next && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(true)}
            className="btn-primary min-h-12 rounded-full px-5 py-2 text-[15px] font-semibold disabled:opacity-60"
          >
            {t('today.skip.andStart', { title: title(next) })}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(false)}
          className="h-12 rounded-full glass text-[15px] font-semibold disabled:opacity-60"
        >
          {t('today.skip.only')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-11 text-sm font-semibold text-ink-muted"
        >
          {t('common.cancel')}
        </button>
      </div>
    </BottomSheet>
  )
}

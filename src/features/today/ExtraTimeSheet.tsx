import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { useToast } from '@/components/toast-store'
import { useAddExtraTime, useStartBlock } from '@/features/plan/actions'
import { useGoalTitle } from '@/features/plan/model'
import { formatDuration } from '@/features/sources/format'
import { useSubjects } from '@/features/subjects/api'
import { cn } from '@/lib/utils'
import { fillPick, pickFor, pickTitle } from './pick'
import type { PlanToday } from './usePlanToday'

const EXTRA_MINUTES = [30, 60, 90] as const

/**
 * "Imam još vremena" (decision after 8b): when today's plan is done, the app picks the most
 * valuable piece for the extra time (`pickForTime()`: a check that is due, else the most urgent
 * next block) and adds it to today, over the daily maximum if needed; the rest of the plan
 * rearranges around it.
 */
export function ExtraTimeSheet({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: PlanToday
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('today.extra.title')}
      subtitle={t('today.extra.sub')}
    >
      {open && <ExtraForm plan={plan} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function ExtraForm({ plan, onDone }: { plan: PlanToday; onDone: () => void }) {
  const { t } = useTranslation()
  const [minutes, setMinutes] = useState<number>(60)
  const [busy, setBusy] = useState(false)
  const { data: subjects = [] } = useSubjects()
  const goalTitle = useGoalTitle()
  const addExtra = useAddExtraTime()
  const start = useStartBlock()
  const show = useToast((s) => s.show)
  const first = pickFor(plan, minutes)
  const pick = first ? fillPick(plan, first, minutes) : null
  // The block the picked units come from: its goal is the goal of the new block.
  const source = pick
    ? plan.blocks.find((b) => b.plan_block_units.some((u) => u.unit_id === pick.units[0]?.unitId))
    : undefined
  const subjectName = subjects.find((s) => s.id === pick?.subjectId)?.name ?? ''

  const add = async (andStart: boolean) => {
    if (!pick || busy) return
    setBusy(true)
    const { draft, undo } = await addExtra({
      subjectId: pick.subjectId,
      kind: pick.kind,
      minutes: pick.minutes,
      unitIds: pick.units.map((u) => u.unitId),
      assessmentId: source?.assessment_id ?? null,
      deadlineId: source?.deadline_id ?? null,
      mode:
        pick.kind === 'review' || pick.kind === 'recap'
          ? 'review'
          : pick.kind === 'questions'
            ? 'questions'
            : 'reading',
    })
    show(t('today.extra.added', { minutes: formatDuration(t, pick.minutes) }), {
      label: t('today.cant.undo'),
      run: () => void undo(),
    })
    onDone()
    if (andStart)
      await start(
        {
          id: draft.id,
          subject_id: draft.subjectId,
          kind: draft.kind,
          planned_minutes: draft.minutes,
          plan_block_units: pick.units.map((u) => ({
            block_id: draft.id,
            unit_id: u.unitId,
            page_from: null,
            page_to: null,
            planned_minutes: u.minutes,
            user_id: '',
          })),
        },
        plan.units,
      )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-2" role="radiogroup" aria-label={t('today.extra.title')}>
        {EXTRA_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === minutes}
            onClick={() => setMinutes(m)}
            className={cn(
              'h-12 flex-1 rounded-full text-[15px] font-semibold',
              m === minutes ? 'bg-ink text-white' : 'glass-flat text-ink',
            )}
          >
            {formatDuration(t, m)}
          </button>
        ))}
      </div>
      {pick ? (
        <>
          <div className="flex flex-col gap-1 rounded-[20px] bg-white/70 px-4 py-3.5">
            <span className="text-xs font-semibold text-ink-muted uppercase">
              {t('today.only.best')}
            </span>
            <span className="text-[17px] font-semibold">
              {pickTitle(t, pick, plan.units, subjectName, goalTitle(source?.deadline_id ?? ''))}
            </span>
            <span className="text-[13px] text-ink-secondary">
              {pick.from === 'review'
                ? t('today.extra.whyReview')
                : t('today.extra.whyNext', { minutes: formatDuration(t, pick.minutes) })}
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void add(true)}
            className="btn-primary flex h-[52px] items-center justify-center rounded-full text-[15px] font-semibold disabled:opacity-60"
          >
            {t('today.extra.addStart')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void add(false)}
            className="h-11 text-sm font-semibold text-brand disabled:opacity-60"
          >
            {t('today.extra.add')}
          </button>
        </>
      ) : (
        <p className="text-sm text-ink-muted">{t('today.only.nothing')}</p>
      )}
    </div>
  )
}

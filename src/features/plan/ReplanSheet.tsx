import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { CalendarIcon } from '@/components/icons'
import { RadioCard } from '@/components/RadioCard'
import { formatDuration } from '@/features/sources/format'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import { addDays, toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { addPerDay, cutCandidates } from '@/lib/scheduler'
import { useCutScope, useRaiseCaps } from './actions'
import { blockTitle, movedBlocks, useGoalTitle, useUnitIndex } from './model'
import type { PlanBlockRow } from './state'
import { usePlanStore } from './store'
import { usePlanUi } from './ui'

type Choice = 'hours' | 'scope' | 'risk'

/**
 * Replan sheet (PRD flow 5): what moved after missed blocks, and the deficit of one goal with
 * three options — more minutes a day, a smaller scope (lowest priority first) or accept the risk.
 */
export function ReplanSheet({
  open,
  onOpenChange,
  goalId,
  missed = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId?: string
  missed?: PlanBlockRow[]
}) {
  const { t } = useTranslation()
  const model = usePlanStore((s) => s.model)
  const deficit = model?.result.deficits.find((d) => !goalId || d.goalId === goalId)
  const title = missed.length > 0 ? t('replan.updated') : t('replan.deficitTitle')
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      leading={
        <span className="icon-tile flex size-[52px] shrink-0 items-center justify-center rounded-2xl">
          <CalendarIcon size={24} />
        </span>
      }
    >
      {open && model && (
        <ReplanBody deficit={deficit} missed={missed} onDone={() => onOpenChange(false)} />
      )}
    </BottomSheet>
  )
}

function ReplanBody({
  deficit,
  missed,
  onDone,
}: {
  deficit:
    | NonNullable<ReturnType<typeof usePlanStore.getState>['model']>['result']['deficits'][number]
    | undefined
  missed: PlanBlockRow[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const model = usePlanStore((s) => s.model)!
  const { data: subjects = [] } = useSubjects()
  const units = useUnitIndex()
  const accept = usePlanUi((s) => s.accept)
  const caps = useRaiseCaps()
  const cut = useCutScope()
  const [choice, setChoice] = useState<Choice>('hours')
  const date = (d: string) =>
    format(toDisplayDate(d), 'EEE, d. MMM', { locale: dateFnsLocales[locale] })
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? ''
  const goalTitleOf = useGoalTitle()
  const goalTitle = (id: string) => goalTitleOf(id) ?? ''
  const today = model.built.today

  const state = model.built.state
  const add = deficit ? addPerDay(state, deficit.minutes, deficit.lastDay) : 0
  const cutList = deficit ? cutCandidates(state, deficit.goalId, deficit.minutes) : []
  const cutNames = cutList
    .slice(0, 3)
    .map((c) => units.get(c.unitId)?.unit)
    .filter(Boolean)
    .map((u) => u!.label ?? u!.title)
  const missedMinutes = missed.reduce((s, b) => s + b.planned_minutes, 0)

  const apply = () => {
    if (!deficit) return onDone()
    if (choice === 'hours')
      caps.mutate({ from: addDays(today, 1), until: deficit.lastDay, cap: (c) => c + add })
    else if (choice === 'scope') cut.mutate(cutList)
    else accept(deficit.goalId, deficit.minutes)
    onDone()
  }

  return (
    <div className="flex flex-col gap-3.5">
      {missed.length > 0 && (
        <>
          <p className="text-sm leading-[1.4] text-ink-secondary">
            {t('replan.missed', {
              count: missed.length,
              subject: subjectName(missed[0]!.subject_id),
              time: formatDuration(t, missedMinutes),
            })}
          </p>
          <MovedList missed={missed} subjectName={subjectName} date={date} />
        </>
      )}
      {deficit ? (
        <>
          <div className="flex flex-col gap-1 rounded-[20px] bg-warning-soft px-4 py-3.5">
            <span className="text-[15px] font-semibold text-warning-ink">
              {t('suggestions.deficit.title', {
                goal: goalTitle(deficit.goalId),
                subject: subjectName(deficit.subjectId),
                time: formatDuration(t, deficit.minutes),
              })}
            </span>
            <span className="text-[13px] leading-[1.35] text-warning-muted">
              {t('replan.deficitSub', { date: date(deficit.lastDay) })}
            </span>
          </div>
          <div role="radiogroup" aria-label={t('replan.choose')} className="flex flex-col gap-2">
            <RadioCard
              checked={choice === 'hours'}
              onSelect={() => setChoice('hours')}
              title={t('replan.hours', { minutes: add })}
              subtitle={t('replan.hoursSub', { date: date(deficit.lastDay) })}
            />
            {cutList.length > 0 && (
              <RadioCard
                checked={choice === 'scope'}
                onSelect={() => setChoice('scope')}
                title={t('replan.scope')}
                subtitle={t('replan.scopeSub', {
                  units: cutNames.join(', ') + (cutList.length > 3 ? ' …' : ''),
                  subject: subjectName(cutList[0]!.subjectId),
                })}
              />
            )}
            <RadioCard
              checked={choice === 'risk'}
              onSelect={() => setChoice('risk')}
              title={t('replan.risk')}
              subtitle={t('replan.riskSub', { time: formatDuration(t, deficit.minutes) })}
            />
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                onDone()
                navigate('/plan/availability')
              }}
              className="flex h-[54px] flex-1 items-center justify-center rounded-full bg-canvas text-[15px] font-semibold"
            >
              {t('replan.availability')}
            </button>
            <button
              type="button"
              onClick={apply}
              className="btn-primary flex h-[54px] flex-[2] items-center justify-center rounded-full text-base font-semibold"
            >
              {t('replan.apply')}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={onDone}
          className="btn-primary flex h-[54px] items-center justify-center rounded-full text-base font-semibold"
        >
          {t('replan.ok')}
        </button>
      )}
    </div>
  )
}

function MovedList({
  missed,
  subjectName,
  date,
}: {
  missed: PlanBlockRow[]
  subjectName: (id: string) => string
  date: (d: string) => string
}) {
  const { t } = useTranslation()
  const units = useUnitIndex()
  const goalTitle = useGoalTitle()
  const moved = useMovedTargets(missed)
  if (moved.length === 0) return null
  return (
    <div className="flex flex-col rounded-[20px] bg-white/40 px-3.5 py-1.5">
      {moved.map(({ block, to }, i) => (
        <div
          key={block.id}
          className={`flex items-center justify-between gap-3 py-2.5 ${i > 0 ? 'border-t border-hairline' : ''}`}
        >
          <span className="min-w-0 truncate text-sm font-semibold">
            {subjectName(block.subject_id).split(' ')[0]} —{' '}
            {blockTitle(t, block, units, goalTitle(block.deadline_id ?? ''))}
          </span>
          <span className="shrink-0 text-[13px] text-brand">
            {to ? `→ ${date(to.on_date)}` : t('replan.notPlanned')}
          </span>
        </div>
      ))}
    </div>
  )
}

function useMovedTargets(missed: PlanBlockRow[]) {
  const model = usePlanStore((s) => s.model)
  const today = model?.built.today ?? ''
  const blocks = usePlanStoreBlocks()
  return movedBlocks(missed, blocks, today)
}

function usePlanStoreBlocks(): PlanBlockRow[] {
  const model = usePlanStore((s) => s.model)
  if (!model) return []
  return model.result.blocks.map((b, i) => ({
    id: `p${i}`,
    user_id: '',
    subject_id: b.subjectId,
    assessment_id: null,
    deadline_id: null,
    on_date: b.onDate,
    start_min: b.startMin,
    planned_start: null,
    planned_minutes: b.minutes,
    kind: b.kind,
    status: 'planned',
    reason: null,
    plan_run_id: null,
    origin: 'ai',
    title: null,
    skip_requested_at: null,
    created_at: '',
    updated_at: '',
    plan_block_units: b.units.map((u) => ({
      block_id: `p${i}`,
      unit_id: u.unitId,
      page_from: u.pageFrom,
      page_to: u.pageTo,
      planned_minutes: Math.round(u.minutes),
      user_id: '',
    })),
  }))
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, ChevronRightIcon, LockIcon, PlusIcon } from '@/components/icons'
import { BlockSheet } from '@/features/plan/BlockSheet'
import { blockSub, blockTitle, isOpen, nextBlock, useGoalTitle } from '@/features/plan/model'
import { reasonOf } from '@/features/plan/save'
import type { PlanBlockRow } from '@/features/plan/state'
import { useActiveSession } from '@/features/session/api'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useSubjects } from '@/features/subjects/api'
import { classesOn, formatClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { BlockStartSheet } from './BlockStartSheet'
import { DoneWithoutTimerSheet } from './DoneWithoutTimerSheet'
import { SkipSheet } from './SkipSheet'
import type { PlanToday } from './usePlanToday'

type Row =
  | { kind: 'block'; at: number; block: PlanBlockRow }
  | { kind: 'class'; at: number; id: string; title: string; sub: string }

function shortName(name: string) {
  return name.split(/\s+/)[0] ?? name
}

/**
 * "Raspored" on Today: the day's blocks and classes by time. Done blocks are ticked, the next one
 * is highlighted (manual blocks carry "ručno"). A tap on an open block asks "Započeti sesiju
 * sada?" first (decision, Stage 10b), a missed one offers "Odradila sam bez timera"; "+ Dodaj blok"
 * adds a block today.
 */
export function TodaySchedule({ plan }: { plan: PlanToday }) {
  const { t } = useTranslation()
  const { data: subjects = [] } = useSubjects()
  const schedule = useScheduleData()
  const { data: active } = useActiveSession()
  const [picked, setPicked] = useState<PlanBlockRow | null>(null)
  const [skipping, setSkipping] = useState<PlanBlockRow | null>(null)
  const [noTimer, setNoTimer] = useState<PlanBlockRow | null>(null)
  // Edit (block), new (null) or the delete question; the key remounts BlockSheet per mode.
  const [editing, setEditing] = useState<{
    open: boolean
    block: PlanBlockRow | null
    deleting: boolean
  }>({ open: false, block: null, deleting: false })
  const dayInput = schedule.dayInput(plan.today)
  const name = (id: string | null) => subjects.find((s) => s.id === id)?.name ?? ''
  const next = nextBlock(plan.todayBlocks, plan.nowMin)
  const goalTitle = useGoalTitle()

  const rows: Row[] = [
    ...plan.todayBlocks.map((block): Row => ({
      kind: 'block',
      at: block.start_min ?? 9999,
      block,
    })),
    ...classesOn(plan.today, dayInput.entries, dayInput.periods)
      .filter((c) => !dayInput.cancelledEntryIds?.has(c.id))
      .map((c): Row => ({
        kind: 'class',
        at: c.startMin,
        id: c.id,
        title: `${shortName(name(c.subjectId))} · ${t(`timetable.kind.${c.kind}`).toLowerCase()}`,
        sub: t('today.schedule.classUntil', { time: formatClock(c.endMin) }),
      })),
  ].sort((a, b) => a.at - b.at)

  return (
    <>
      <h2 className="mx-1.5 mt-[26px] mb-2.5 text-xl font-bold tracking-[-0.4px]">
        {t('today.schedule.title')}
      </h2>
      <div className="glass overflow-hidden rounded-[26px]">
        {rows.map((row, i) => {
          const divider = i > 0 && <div className="ml-[72px] h-px bg-line/90" />
          if (row.kind === 'class')
            return (
              <div key={row.id}>
                {divider}
                <div className="flex items-center gap-3 px-4 py-[13px]">
                  <span className="w-11 text-[13px] font-medium text-ink-muted tabular-nums">
                    {formatClock(row.at)}
                  </span>
                  <span
                    className="size-[22px] shrink-0 rounded-full bg-[repeating-linear-gradient(135deg,var(--color-line)_0_3px,transparent_3px_6px)]"
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-base">{row.title}</span>
                    <span className="text-[13px] text-ink-muted">{row.sub}</span>
                  </span>
                </div>
              </div>
            )
          const b = row.block
          const done = b.status === 'done'
          const current = next?.id === b.id
          const closed = !isOpen(b)
          // A missed block can still be marked done without the timer.
          const canOpen = isOpen(b) || b.status === 'missed'
          const status =
            b.status === 'missed'
              ? t('planBlocks.missed')
              : b.status === 'skipped'
                ? t('planBlocks.skipped')
                : null
          const content = (
            <>
              <span
                className={cn(
                  'w-11 text-[13px] tabular-nums',
                  current ? 'font-bold text-brand' : 'font-medium text-ink-muted',
                )}
              >
                {b.start_min === null ? '—' : formatClock(b.start_min)}
              </span>
              {done ? (
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <CheckIcon size={13} />
                </span>
              ) : (
                <span
                  className={cn(
                    'size-[22px] shrink-0 rounded-full border-2',
                    current ? 'border-brand-accent' : 'border-radio-ring',
                  )}
                />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-px text-left">
                <span
                  className={cn(
                    'truncate text-base',
                    closed ? 'text-ink-muted' : 'font-semibold',
                    done && 'line-through',
                  )}
                >
                  {b.origin === 'user' && (
                    <LockIcon size={13} className="mr-1 inline align-[-1px] text-ink-muted" />
                  )}
                  {shortName(name(b.subject_id))} —{' '}
                  {blockTitle(t, b, plan.units, goalTitle(b.deadline_id ?? ''))}
                </span>
                <span className="truncate text-[13px] text-ink-secondary">
                  {[
                    blockSub(t, b, plan.units),
                    b.origin === 'user'
                      ? reasonOf(b)?.carried
                        ? t('today.skip.carried')
                        : t('planBlocks.manual')
                      : null,
                    status,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {canOpen && <ChevronRightIcon size={16} className="text-ink-subtle" />}
            </>
          )
          return (
            <div key={b.id}>
              {divider}
              {canOpen ? (
                <button
                  type="button"
                  onClick={() => (isOpen(b) ? setPicked(b) : setNoTimer(b))}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-[13px]',
                    current && 'bg-canvas-soft',
                  )}
                >
                  {content}
                </button>
              ) : (
                <div
                  className={cn(
                    'flex items-center gap-3 px-4 py-[13px]',
                    current && 'bg-canvas-soft',
                  )}
                >
                  {content}
                </div>
              )}
            </div>
          )
        })}
        {rows.length > 0 && <div className="ml-[72px] h-px bg-line/90" />}
        <button
          type="button"
          onClick={() => setEditing({ open: true, block: null, deleting: false })}
          className="flex w-full items-center gap-3 px-4 py-[13px]"
        >
          <span className="w-11" />
          <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <PlusIcon size={14} />
          </span>
          <span className="text-base font-semibold text-brand">{t('blockSheet.add')}</span>
        </button>
      </div>
      <BlockStartSheet
        block={picked}
        plan={plan}
        canStart={!active}
        onClose={() => setPicked(null)}
        onEdit={(b) => {
          setPicked(null)
          setEditing({ open: true, block: b, deleting: false })
        }}
        onSkip={(b) => {
          setPicked(null)
          setSkipping(b)
        }}
        onDrop={(b) => {
          setPicked(null)
          setEditing({ open: true, block: b, deleting: true })
        }}
        onNoTimer={(b) => {
          setPicked(null)
          setNoTimer(b)
        }}
      />
      <DoneWithoutTimerSheet block={noTimer} plan={plan} onClose={() => setNoTimer(null)} />
      <SkipSheet block={skipping} plan={plan} onClose={() => setSkipping(null)} />
      <BlockSheet
        key={`${editing.block?.id ?? 'new'}-${editing.deleting}`}
        open={editing.open}
        onOpenChange={(open) => setEditing((e) => ({ ...e, open }))}
        block={editing.block}
        date={plan.today}
        today={plan.today}
        startDeleting={editing.deleting}
      />
    </>
  )
}

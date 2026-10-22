import { useTranslation } from 'react-i18next'
import { useDayBoundary } from '@/features/settings/profile'
import { useSubjects } from '@/features/subjects/api'
import type { LocalDate } from '@/lib/day'
import { usePlanBlocks } from './api'
import { blocksOn, blockSub, blockTitle, useGoalTitle, useUnitIndex } from './model'
import { reasonOf } from './save'
import type { DayBlock } from './DayTimeline'
import type { PlanBlockRow } from './state'
import { usePlanStore } from './store'

export interface DayBlockView {
  block: PlanBlockRow
  /** Its time, or where `placeTimes()` put a manual block without one. */
  startMin: number | null
  title: string
  sub: string
  color: string | null
  done: boolean
  manual: boolean
  /** A manual block that was an AI block ("Vrati predloženo"). */
  edited: boolean
}

/** The plan blocks of a day as the calendar, Satnica and the day list show them. */
export function useDayBlocks() {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const blocks = usePlanBlocks(boundary).data ?? []
  const units = useUnitIndex()
  const fixedTimes = usePlanStore((s) => s.model?.result.fixedTimes)
  const { data: subjects = [] } = useSubjects()
  const goalTitle = useGoalTitle()
  const statusText = (b: PlanBlockRow) =>
    b.status === 'done'
      ? t('planBlocks.done')
      : b.status === 'missed'
        ? t('planBlocks.missed')
        : null

  return {
    hasBlocks: (date: LocalDate) =>
      blocks.some((b) => b.on_date === date && b.status !== 'skipped'),
    blocksFor: (date: LocalDate): DayBlockView[] =>
      blocksOn(blocks, date)
        .filter((b) => b.status !== 'skipped')
        .map((b) => {
          const subject = subjects.find((s) => s.id === b.subject_id)
          return {
            block: b,
            startMin: b.start_min ?? fixedTimes?.[b.id] ?? null,
            title: `${(subject?.name ?? '').split(' ')[0]} — ${blockTitle(t, b, units, goalTitle(b.deadline_id ?? ''))}`,
            sub: [
              blockSub(t, b, units),
              b.origin === 'user' ? t('planBlocks.manual') : null,
              statusText(b),
            ]
              .filter(Boolean)
              .join(' · '),
            color: subject?.color ?? null,
            done: b.status === 'done',
            manual: b.origin === 'user',
            edited: b.origin === 'user' && reasonOf(b)?.edited === true,
          }
        }),
  }
}

/** Timed blocks for the day axis (a block without a time stays in the list below). */
export function toTimeline(blocks: DayBlockView[]): DayBlock[] {
  return blocks
    .filter((b) => b.startMin !== null)
    .map((b) => ({
      id: b.block.id,
      startMin: b.startMin!,
      endMin: b.startMin! + b.block.planned_minutes,
      title: b.title,
      sub: b.sub,
      color: b.color,
      done: b.done,
      manual: b.manual,
      block: b.block,
    }))
}

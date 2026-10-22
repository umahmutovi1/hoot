import type { TFunction } from 'i18next'
import { useMemo } from 'react'
import { formatDuration, pagesLabel } from '@/features/sources/format'
import { measureOf, type Source, type Unit } from '@/features/sources/model'
import { isMeasured, type StudyMode } from '@/lib/estimates/calibration'
import { STUDY_MODES } from '@/features/session/model'
import type { Measure } from '@/lib/outline/parse'
import { formatClock } from '@/lib/schedule'
import type { Reason } from '@/lib/scheduler'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { useAllSources } from './api'
import { reasonOf } from './save'
import type { PlanBlockRow } from './state'

/** Every unit of the user with its source, for block titles and page ranges. */
export interface UnitInfo {
  unit: Unit
  source: Source
  measure: Measure
  /** 3+ sessions: blocks may show their scope (pages), not only the duration. */
  measured: boolean
}

export function useUnitIndex(): Map<string, UnitInfo> {
  const sources = useAllSources().data
  return useMemo(() => {
    const out = new Map<string, UnitInfo>()
    for (const s of sources ?? []) {
      const measure = measureOf(s)
      const measured = isMeasured(s.measured_sessions)
      for (const u of s.units) out.set(u.id, { unit: u, source: s, measure, measured })
    }
    return out
  }, [sources])
}

/** Blocks of one day by time (blocks without a time last). */
export function blocksOn(blocks: PlanBlockRow[], date: string): PlanBlockRow[] {
  return blocks
    .filter((b) => b.on_date === date)
    .sort(
      (a, b) =>
        (a.start_min ?? 9999) - (b.start_min ?? 9999) || a.created_at.localeCompare(b.created_at),
    )
}

export const isOpen = (b: PlanBlockRow) => b.status === 'planned' || b.status === 'in_progress'

/**
 * "Sljedeće": the block running now or the next one today; an earlier block not done yet when
 * nothing is left later.
 */
export function nextBlock(today: PlanBlockRow[], nowMin: number): PlanBlockRow | null {
  const open = today.filter(isOpen)
  return (
    open.find((b) => b.status === 'in_progress') ??
    open.find((b) => b.start_min === null || b.start_min + b.planned_minutes > nowMin) ??
    open[0] ??
    null
  )
}

/** Rough parts ("~3") show only their title ("Dio 3"). */
const shownLabel = (u: Unit) => (u.label && !u.label.startsWith('~') ? u.label : null)

function unitLabel(u: Unit) {
  const label = shownLabel(u)
  return label ? `${label} ${u.title}` : u.title
}

/** Title of a goal (exam or deadline) by id. */
export function useGoalTitle(): (id: string) => string | null {
  const { data: subjects = [] } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  return useMemo(() => {
    const titles = new Map<string, string>([
      ...subjects.flatMap((s) => s.assessments.map((a) => [a.id, a.title] as const)),
      ...deadlines.map((d) => [d.id, d.title] as const),
    ])
    return (id: string) => titles.get(id) ?? null
  }, [subjects, deadlines])
}

/**
 * Block title (Danas, Plan): the units it covers ("5.1–5.3 Normalizacija"), a manual block's own
 * title, or the kind for blocks without units.
 */
export function blockTitle(
  t: TFunction,
  block: Pick<PlanBlockRow, 'kind' | 'title' | 'plan_block_units'>,
  units: Map<string, UnitInfo>,
  goalTitle?: string | null,
): string {
  if (block.title) return block.title
  if (block.kind === 'deadline' && goalTitle) return goalTitle
  const list = block.plan_block_units
    .map((u) => units.get(u.unit_id)?.unit)
    .filter((u): u is Unit => Boolean(u))
    .sort((a, b) => a.position - b.position)
  if (block.kind === 'review' && list.length > 1)
    return t('planBlocks.reviewUnits', { count: list.length })
  if (list.length === 0) return t(`planBlocks.kind.${block.kind}`)
  if (list.length === 1) return unitLabel(list[0]!)
  const first = list[0]!
  const last = list[list.length - 1]!
  const a = shownLabel(first)
  const b = shownLabel(last)
  if (a && b) return `${a}–${b} ${first.title}`
  if (!a && !b && first.label && last.label)
    return `${first.title}–${last.title.replace(/^\D+/, '')}`
  return t('planBlocks.unitsMore', { title: first.title, count: list.length - 1 })
}

/** Study mode of a block, as the session will start it. */
export function blockMode(
  block: Pick<PlanBlockRow, 'kind' | 'plan_block_units'> & { reason?: string | null },
  units: Map<string, UnitInfo>,
) {
  const manual = block.reason ? reasonOf({ reason: block.reason }) : null
  if (manual?.code === 'manual' && manual.mode && STUDY_MODES.includes(manual.mode as StudyMode))
    return manual.mode as StudyMode
  if (block.kind === 'questions') return 'questions' as const
  if (block.kind === 'review' || block.kind === 'recap') return 'review' as const
  const first = units.get(block.plan_block_units[0]?.unit_id ?? '')?.unit
  if (first?.kind === 'question') return 'questions' as const
  return first && first.level > 0 ? ('review' as const) : ('reading' as const)
}

/** "Čitanje · 60 min" (+ "str. 142–168" once the source is measured). */
export function blockSub(
  t: TFunction,
  block: Pick<PlanBlockRow, 'kind' | 'planned_minutes' | 'plan_block_units'> & {
    reason?: string | null
  },
  units: Map<string, UnitInfo>,
): string {
  const mode = t(`planBlocks.mode.${block.kind === 'learn' ? blockMode(block, units) : block.kind}`)
  return `${mode} · ${formatDuration(t, block.planned_minutes)}`
}

/** "str. 142–168" for a measured source (PRD "Prije mjerenja"); null before 3 sessions. */
export function blockPages(
  t: TFunction,
  block: Pick<PlanBlockRow, 'plan_block_units'>,
  units: Map<string, UnitInfo>,
): string | null {
  const parts = block.plan_block_units
    .map((u) => ({ row: u, info: units.get(u.unit_id) }))
    .filter((x) => x.info?.measured && x.info.measure === 'pages')
  if (parts.length === 0) return null
  const from = Math.min(...parts.map((p) => p.row.page_from ?? p.info!.unit.page_start ?? Infinity))
  const to = Math.max(...parts.map((p) => p.row.page_to ?? p.info!.unit.page_end ?? -Infinity))
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return pagesLabel(t, 'pages', { page_start: from, page_end: to })
}

export function clockOf(block: Pick<PlanBlockRow, 'start_min'>): string | null {
  return block.start_min === null ? null : formatClock(block.start_min)
}

/** "Zašto ovo danas" for a block: the rule that put it there, in the user's language. */
export function reasonText(
  t: TFunction,
  block: Pick<PlanBlockRow, 'reason'>,
  ctx: { goalTitle: (id: string) => string | null; formatDate: (date: string) => string },
): string | null {
  const reason: Reason | null = reasonOf(block)
  if (!reason) return null
  const goal = reason.goalId ? (ctx.goalTitle(reason.goalId) ?? '') : ''
  const parts: string[] = []
  const days = reason.days ?? 0
  switch (reason.code) {
    case 'review':
      parts.push(t('planBlocks.why.review'))
      break
    case 'recap':
      parts.push(t('planBlocks.why.recap'))
      break
    case 'buffer':
      parts.push(t('planBlocks.why.buffer', { goal, count: days }))
      break
    case 'exam':
      parts.push(t('planBlocks.why.exam', { goal, count: days }))
      break
    case 'deadline':
      parts.push(t('planBlocks.why.deadline', { goal, count: days }))
      break
    case 'lecture':
      parts.push(t('planBlocks.why.lecture', { date: ctx.formatDate(reason.date ?? '') }))
      break
    case 'campaign_start':
      parts.push(t('planBlocks.why.campaignStart'))
      break
    case 'optional':
      parts.push(t('planBlocks.why.optional', { goal }))
      break
    case 'manual':
      return null
  }
  if (reason.conditional) parts.push(t('planBlocks.why.conditional'))
  if (reason.boost) parts.push(t('planBlocks.why.boost'))
  return parts.join(' · ')
}

/** Where the units of missed blocks went in the new plan ("→ uto, 20. okt"). */
export function movedBlocks(missed: PlanBlockRow[], blocks: PlanBlockRow[], from: string) {
  return missed.map((b) => {
    const ids = new Set(b.plan_block_units.map((u) => u.unit_id))
    const to = blocks
      .filter(
        (x) =>
          x.on_date >= from &&
          x.status === 'planned' &&
          x.plan_block_units.some((u) => ids.has(u.unit_id)),
      )
      .sort(
        (x, y) => x.on_date.localeCompare(y.on_date) || (x.start_min ?? 0) - (y.start_min ?? 0),
      )[0]
    return { block: b, to }
  })
}

import type { TFunction } from 'i18next'
import { useNavigate } from 'react-router-dom'
import { format, type Locale } from 'date-fns'
import { formatDuration } from '@/features/sources/format'
import { toDisplayDate } from '@/lib/day'
import type { useTranslation } from 'react-i18next'
import { useStartBlock } from '@/features/plan/actions'
import { blockTitle, isOpen, type UnitInfo } from '@/features/plan/model'
import { reasonOf } from '@/features/plan/save'
import type { PlanBlockRow } from '@/features/plan/state'
import { useSessionWriter } from '@/features/session/api'
import { usePresets } from '@/features/session/presets'
import { useSessionUi } from '@/features/session/store'
import { pickForTime, reviewMinutes, type Pick, type PickBlock } from '@/lib/scheduler'
import { dueUnits } from '@/features/review/due'
import { useStartCheck } from '@/features/review/useStartCheck'
import type { PlanToday } from './usePlanToday'

// "Imam samo X min" (PRD "Brze akcije dana"): `pickForTime()` over the saved plan, and starting
// the picked piece. Used by the Today sheet and by PokreniSesiju.

export const ONLY_MINUTES = [15, 30, 45, 60] as const

export function toPickBlock(b: PlanBlockRow): PickBlock {
  return {
    id: b.id,
    subjectId: b.subject_id,
    kind: b.kind,
    onDate: b.on_date,
    startMin: b.start_min,
    minutes: b.planned_minutes,
    daysToGoal: reasonOf(b)?.days ?? null,
    units: b.plan_block_units.map((u) => ({ unitId: u.unit_id, minutes: u.planned_minutes })),
  }
}

/** `pickForTime()` over today's plan, the checks due and the next blocks (optionally one subject). */
export function pickFor(plan: PlanToday, minutes: number, subjectId?: string): Pick | null {
  const sourceOf = new Map([...plan.units.values()].map((i) => [i.unit.id, i.source]))
  const dueReviews = dueUnits(
    [...plan.units.values()].map((i) => i.unit),
    plan.cards,
    plan.today,
    plan.boundary,
    plan.fsrsParams,
  ).map((d) => ({
    unitId: d.unit.id,
    subjectId: sourceOf.get(d.unit.id)!.subject_id,
    minutes: reviewMinutes(
      d.unit.kind === 'question' ? 'question' : 'chapter',
      Number(d.unit.est_minutes ?? 20),
    ),
    retrievability: d.strength,
    nextReviewOn: d.unit.next_review_on ?? plan.today,
  }))
  return pickForTime({
    minutes,
    today: plan.today,
    todayBlocks: plan.todayBlocks.filter(isOpen).map(toPickBlock),
    dueReviews,
    laterBlocks: plan.blocks.filter((b) => b.on_date > plan.today && isOpen(b)).map(toPickBlock),
    subjectId,
  })
}

/**
 * Slobodna sesija → "Hoot predloži" with "Druga ideja": the best piece for the time, then the best
 * piece of each other subject that has one, up to `limit` (all from `pickForTime()`, no AI).
 */
export function picksFor(
  plan: PlanToday,
  minutes: number,
  subjectIds: string[],
  limit = 3,
): Pick[] {
  const first = pickFor(plan, minutes)
  const out = first ? [first] : []
  for (const id of subjectIds) {
    if (out.length >= limit) break
    if (out.some((p) => p.subjectId === id)) continue
    const pick = pickFor(plan, minutes, id)
    if (pick) out.push(pick)
  }
  return out
}

/**
 * "Imam još vremena": the pick filled up to `minutes` with the next units of the same subject from
 * its later blocks (in plan order), so 90 min are not cut to one 50 min block.
 */
export function fillPick(plan: PlanToday, pick: Pick, minutes: number): Pick {
  if (pick.from !== 'next' || pick.minutes >= minutes) return pick
  const units = [...pick.units]
  let total = pick.minutes
  const later = plan.blocks
    .filter((b) => b.on_date > plan.today && isOpen(b) && b.subject_id === pick.subjectId)
    .sort((a, b) => a.on_date.localeCompare(b.on_date) || (a.start_min ?? 0) - (b.start_min ?? 0))
  for (const b of later)
    for (const u of b.plan_block_units) {
      if (total >= minutes) break
      if (units.some((x) => x.unitId === u.unit_id)) continue
      const m = Math.min(u.planned_minutes, minutes - total)
      units.push({ unitId: u.unit_id, minutes: m })
      total += m
    }
  return { ...pick, units, minutes: total }
}

/** Why the piece was picked: a check due, (part of) today's block, or a later block's day. */
export function pickWhy(t: TFunction, plan: PlanToday, pick: Pick, dfLocale: Locale): string {
  if (pick.from === 'review')
    return t('today.only.whyReview', { minutes: formatDuration(t, pick.minutes) })
  if (pick.from === 'today') {
    const block = plan.blocks.find((b) => b.id === pick.blockId)
    return block && pick.minutes < block.planned_minutes
      ? t('today.only.whyPart')
      : t('today.only.whyWhole')
  }
  const later = plan.blocks.find(
    (b) => isOpen(b) && b.on_date > plan.today && b.subject_id === pick.subjectId,
  )
  return t('today.only.whyNext', {
    day: later ? format(toDisplayDate(later.on_date), 'EEEE', { locale: dfLocale }) : '',
  })
}

/** Title of a picked piece: subject and the units it covers. */
export function pickTitle(
  t: ReturnType<typeof useTranslation>['t'],
  pick: Pick,
  units: Map<string, UnitInfo>,
  subjectName: string,
  goalTitle?: string | null,
) {
  const title = blockTitle(
    t,
    {
      kind: pick.kind,
      title: null,
      plan_block_units: pick.units.map((u) => ({
        unit_id: u.unitId,
        block_id: '',
        page_from: null,
        page_to: null,
        planned_minutes: u.minutes,
        user_id: '',
      })),
    },
    units,
    goalTitle,
  )
  return `${subjectName} · ${title}`
}

/**
 * Starts the session of a picked piece: tied to today's block it comes from, a later block's
 * subject and units without tying it, or a loose check.
 */
export function useStartPick(plan: PlanToday) {
  const navigate = useNavigate()
  const startBlock = useStartBlock()
  const writer = useSessionWriter()
  const { suggestedId } = usePresets()
  const setTimerMode = useSessionUi((s) => s.setTimerMode)
  const startCheck = useStartCheck()
  return async (pick: Pick, timerMode = suggestedId) => {
    const block = plan.blocks.find((b) => b.id === pick.blockId)
    const later =
      pick.from === 'next'
        ? plan.blocks.find(
            (b) => isOpen(b) && b.on_date > plan.today && b.subject_id === pick.subjectId,
          )
        : undefined
    const unitId = pick.units[0]?.unitId ?? null
    const checkUnits = pick.from === 'review' ? pick.units.map((u) => u.unitId) : undefined
    if (block)
      await startBlock(block, plan.units, { minutes: pick.minutes, unitId, timerMode, checkUnits })
    else if (later)
      await startBlock(later, plan.units, { minutes: pick.minutes, tied: false, unitId, timerMode })
    else if (pick.from === 'review')
      await startCheck(pick.subjectId, checkUnits!, pick.minutes, timerMode)
    else {
      await writer.start({
        subjectId: pick.subjectId,
        unitId,
        mode: 'review',
        timerMode,
        plannedMinutes: pick.minutes,
      })
      setTimerMode(timerMode)
      navigate('/session')
    }
  }
}

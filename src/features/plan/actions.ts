import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { syncQueueFor } from '@/app/sync'
import { useAuth } from '@/features/auth/auth-context'
import { scheduleKey } from '@/features/schedule/api'
import type { DayRow } from '@/features/schedule/model'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useSessionWriter } from '@/features/session/api'
import { usePresets } from '@/features/session/presets'
import { useSessionUi } from '@/features/session/store'
import { subjectsKey } from '@/features/subjects/api'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import { addDays, type LocalDate } from '@/lib/day'
import { capFor } from '@/lib/schedule'
import type { CutUnit } from '@/lib/scheduler'
import { supabase } from '@/lib/supabase'
import type { Op } from '@/lib/sync'
import { planBlocksKey } from './api'
import { blockMode, type UnitInfo } from './model'
import type { PlanBlockRow } from './state'
import { usePlanStore } from './store'

// One-tap changes of plan inputs (suggestion cards, Replan sheet, quick actions). Each one
// writes the input and replans right away; the plan itself is never edited here.

function useUserId() {
  return useAuth().session?.user.id
}

/** Writes through the offline queue and refreshes the plan's own queries once sent. */
function useQueueWrite() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useCallback(
    async (ops: Op[]) => {
      if (!userId) return
      const queue = syncQueueFor(userId)
      await queue.enqueue(...ops)
      if (navigator.onLine) await queue.flush()
      void queryClient.invalidateQueries({ queryKey: planBlocksKey(userId) })
    },
    [userId, queryClient],
  )
}

/**
 * "Danas ne mogu" (PRD "Brze akcije dana"): today becomes a day without free slots and today's
 * AI blocks are skipped (not missed, and not counted in ρ); replan starts tomorrow. Returns an
 * undo that restores the day and the blocks.
 */
export function useCantToday() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const write = useQueueWrite()
  const replanNow = usePlanStore((s) => s.replanNow)
  const daysKey = scheduleKey('availability_days', userId)

  return useCallback(
    async (today: LocalDate) => {
      const previous = queryClient.getQueryData<DayRow[]>(daysKey)?.find((d) => d.on_date === today)
      const id = previous?.id ?? crypto.randomUUID()
      const now = new Date().toISOString()
      const setDay = (row: DayRow | null) =>
        queryClient.setQueryData<DayRow[]>(daysKey, (list = []) => [
          ...list.filter((d) => d.on_date !== today),
          ...(row ? [row] : []),
        ])
      const setBlocks = (from: PlanBlockRow['status'], to: PlanBlockRow['status']) =>
        queryClient.setQueryData<PlanBlockRow[]>(planBlocksKey(userId), (list = []) =>
          list.map((b) =>
            b.on_date === today && b.origin === 'ai' && b.status === from
              ? { ...b, status: to }
              : b,
          ),
        )

      setDay({
        id,
        user_id: userId!,
        on_date: today,
        slots: [],
        cap_min: previous?.cap_min ?? null,
        created_at: previous?.created_at ?? now,
        updated_at: now,
      })
      setBlocks('planned', 'skipped')
      await write([
        {
          kind: 'upsert',
          table: 'availability_days',
          rows: [{ id, on_date: today, slots: [], cap_min: previous?.cap_min ?? null }],
        },
        {
          kind: 'update',
          table: 'plan_blocks',
          match: { on_date: today, origin: 'ai', status: 'planned' },
          patch: { status: 'skipped' },
        },
      ])
      void queryClient.invalidateQueries({ queryKey: daysKey })
      replanNow()

      return async () => {
        setDay(previous ?? null)
        setBlocks('skipped', 'planned')
        await write([
          previous
            ? {
                kind: 'upsert',
                table: 'availability_days',
                rows: [{ id, on_date: today, slots: previous.slots, cap_min: previous.cap_min }],
              }
            : { kind: 'delete', table: 'availability_days', match: { id } },
          {
            kind: 'update',
            table: 'plan_blocks',
            match: { on_date: today, origin: 'ai', status: 'skipped' },
            patch: { status: 'planned' },
          },
        ])
        void queryClient.invalidateQueries({ queryKey: daysKey })
        replanNow()
      }
    },
    [userId, queryClient, write, replanNow, daysKey],
  )
}

type SubjectPatch = Partial<
  Pick<
    SubjectWithAssessments,
    'priority' | 'study_mode' | 'campaign_start_on' | 'priority_boost_until'
  >
>

/** A subject field set by a suggestion (priority, mode, campaign start, boost). */
export function usePatchSubject() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const replanNow = usePlanStore((s) => s.replanNow)
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SubjectPatch }) => {
      const { error } = await supabase.from('subjects').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, patch }) => {
      const key = subjectsKey(userId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<SubjectWithAssessments[]>(key)
      queryClient.setQueryData<SubjectWithAssessments[]>(key, (list = []) =>
        list.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      )
      return () => queryClient.setQueryData(key, previous)
    },
    onError: (_e, _v, rollback) => rollback?.(),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: subjectsKey(userId) })
      replanNow()
    },
  })
}

/**
 * More study time on the days from `from` to `until`: each day's cap becomes `cap(day)` from
 * the function ("Dodaj X min dnevno", exam period → 6 h); slots stay as they are.
 */
export function useRaiseCaps() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const schedule = useScheduleData()
  const replanNow = usePlanStore((s) => s.replanNow)
  return useMutation({
    mutationFn: async ({
      from,
      until,
      cap,
    }: {
      from: LocalDate
      until: LocalDate
      cap: (current: number) => number
    }) => {
      const rows: { id: string; on_date: string; slots: unknown; cap_min: number }[] = []
      for (let d = from; d <= until; d = addDays(d, 1)) {
        const existing = schedule.dayRows.find((r) => r.on_date === d)
        const current = capFor(d, schedule.dayInput(d))
        const next = Math.min(1440, cap(current))
        if (next === current) continue
        rows.push({
          id: existing?.id ?? crypto.randomUUID(),
          on_date: d,
          slots: existing?.slots ?? null,
          cap_min: next,
        })
      }
      if (rows.length === 0) return
      const { error } = await supabase.from('availability_days').upsert(rows as never)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleKey('availability_days', userId) })
      replanNow()
    },
  })
}

/** "Smanji obim" / "Izbaci iz plana": the units do not count for that exam any more. */
export function useCutScope() {
  const queryClient = useQueryClient()
  const replanNow = usePlanStore((s) => s.replanNow)
  return useMutation({
    mutationFn: async (units: Pick<CutUnit, 'unitId' | 'goalId'>[]) => {
      if (units.length === 0) return
      const { error } = await supabase.from('assessment_units').upsert(
        units.map((u) => ({
          assessment_id: u.goalId,
          unit_id: u.unitId,
          included: false,
          assigned_by: 'user' as const,
        })),
        { onConflict: 'assessment_id,unit_id' },
      )
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['scope'] })
      replanNow()
    },
  })
}

/** Starts the session of a block (PRD flow 4): its first unit, its mode and its planned length. */
export function useStartBlock() {
  const navigate = useNavigate()
  const writer = useSessionWriter()
  const { suggestedId } = usePresets()
  const setTimerMode = useSessionUi((s) => s.setTimerMode)
  return useCallback(
    async (
      block: Pick<
        PlanBlockRow,
        'id' | 'subject_id' | 'kind' | 'planned_minutes' | 'plan_block_units'
      >,
      units: Map<string, UnitInfo>,
      opts: { minutes?: number; unitId?: string | null; tied?: boolean; timerMode?: string } = {},
    ) => {
      const timerMode = opts.timerMode ?? suggestedId
      await writer.start({
        subjectId: block.subject_id,
        unitId:
          opts.unitId !== undefined ? opts.unitId : (block.plan_block_units[0]?.unit_id ?? null),
        mode: blockMode(block, units),
        timerMode,
        blockId: opts.tied === false ? null : block.id,
        plannedMinutes: opts.minutes ?? block.planned_minutes,
      })
      setTimerMode(timerMode)
      navigate('/session')
    },
    [writer, suggestedId, setTimerMode, navigate],
  )
}

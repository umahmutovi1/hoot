import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { syncQueueFor } from '@/app/sync'
import { useToast } from '@/components/toast-store'
import { useAuth } from '@/features/auth/auth-context'
import { scheduleKey } from '@/features/schedule/api'
import type { DayRow, ExceptionRow } from '@/features/schedule/model'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useSessionWriter } from '@/features/session/api'
import { usePresets } from '@/features/session/presets'
import { useDayBoundary } from '@/features/settings/profile'
import { useSessionUi } from '@/features/session/store'
import { subjectsKey } from '@/features/subjects/api'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import { addDays, localDay, wallClock, zonedInstant, type LocalDate } from '@/lib/day'
import { capFor, freeSlotsOn } from '@/lib/schedule'
import { LATE_AFTER_MIN, shiftRestOfDay, spanOf, type CutUnit } from '@/lib/scheduler'
import { supabase } from '@/lib/supabase'
import type { Op, Row } from '@/lib/sync'
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
  const shiftLate = useShiftLateDay()
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
      const minutes = opts.minutes ?? block.planned_minutes
      if (opts.tied !== false) await shiftLate(block.id, minutes)
      await writer.start({
        subjectId: block.subject_id,
        unitId:
          opts.unitId !== undefined ? opts.unitId : (block.plan_block_units[0]?.unit_id ?? null),
        mode: blockMode(block, units),
        timerMode,
        blockId: opts.tied === false ? null : block.id,
        plannedMinutes: minutes,
      })
      setTimerMode(timerMode)
      navigate('/session')
    },
    [writer, suggestedId, setTimerMode, navigate, shiftLate],
  )
}

/**
 * Late start (decision after 8b): starting today's block more than 5 min after its time moves the
 * started block to now and the rest of the day after it, manual blocks too, in order and only into
 * free time (`shiftRestOfDay()`). AI blocks that no longer fit today go back to the plan (from
 * tomorrow, at the next replan); manual ones stay on the day without a time. Toast with undo.
 */
function useShiftLateDay() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const write = useQueueWrite()
  const boundary = useDayBoundary()
  const schedule = useScheduleData()
  const { resolve, defaultId } = usePresets()
  const show = useToast((s) => s.show)
  const { t } = useTranslation()
  // "San pred ispit": the day before an exam nothing is moved past `exam_eve_end_min`.
  const examEveEnd = (today: LocalDate) => {
    const state = usePlanStore.getState().model?.built.state
    if (!state) return null
    const eve = state.goals.some((g) => g.kind === 'exam' && g.on === addDays(today, 1))
    return eve ? state.settings.examEveEndMin : null
  }
  return useCallback(
    async (blockId: string, minutes: number) => {
      const key = planBlocksKey(userId)
      const blocks = queryClient.getQueryData<PlanBlockRow[]>(key) ?? []
      const block = blocks.find((b) => b.id === blockId)
      const now = new Date()
      const today = localDay(now, boundary)
      const wall = wallClock(now, boundary.timeZone).minutes
      const nowMin = wall < boundary.dayStartMin ? wall + 1440 : wall
      if (!block || block.on_date !== today || block.start_min === null) return
      if (nowMin <= block.start_min + LATE_AFTER_MIN) return

      const later = blocks.filter(
        (b) =>
          b.id !== block.id &&
          b.on_date === today &&
          b.status === 'planned' &&
          b.start_min !== null &&
          b.start_min > block.start_min!,
      )
      const { moved, overflow } = shiftRestOfDay(
        { minutes },
        later.map((b) => ({ id: b.id, startMin: b.start_min!, minutes: b.planned_minutes })),
        freeSlotsOn(today, schedule.dayInput(today)),
        { nowMin, preset: resolve(defaultId), endBy: examEveEnd(today) },
      )
      const at = (min: number | null) =>
        min === null ? null : zonedInstant(today, min, boundary.timeZone).toISOString()
      const timeOps = (b: PlanBlockRow, min: number | null): Op => ({
        kind: 'update',
        table: 'plan_blocks',
        match: { id: b.id },
        patch: { start_min: min, planned_start: at(min) },
      })
      const dropped = later.filter((b) => overflow.includes(b.id) && b.origin === 'ai')
      const untimed = later.filter((b) => overflow.includes(b.id) && b.origin === 'user')
      const shifted = later.filter((b) => moved.has(b.id))
      const ops: Op[] = [
        timeOps(block, nowMin),
        ...shifted.map((b) => timeOps(b, moved.get(b.id)!)),
        ...untimed.map((b) => timeOps(b, null)),
        ...dropped.map((b): Op => ({ kind: 'delete', table: 'plan_blocks', match: { id: b.id } })),
      ]
      queryClient.setQueryData<PlanBlockRow[]>(key, (list = []) =>
        list
          .filter((b) => !dropped.some((d) => d.id === b.id))
          .map((b) =>
            b.id === block.id
              ? { ...b, start_min: nowMin, planned_start: at(nowMin) }
              : moved.has(b.id)
                ? { ...b, start_min: moved.get(b.id)!, planned_start: at(moved.get(b.id)!) }
                : untimed.some((u) => u.id === b.id)
                  ? { ...b, start_min: null, planned_start: null }
                  : b,
          ),
      )
      await write(ops)

      const changed = [block, ...shifted, ...untimed]
      show(
        overflow.length > 0
          ? t('today.late.shiftedOverflow', {
              min: nowMin - block.start_min,
              count: overflow.length,
            })
          : t('today.late.shifted', { min: nowMin - block.start_min }),
        {
          label: t('today.cant.undo'),
          run: () => {
            queryClient.setQueryData<PlanBlockRow[]>(key, (list = []) => [
              ...list
                .filter((b) => !dropped.some((d) => d.id === b.id))
                .map((b) => changed.find((c) => c.id === b.id) ?? b),
              ...dropped,
            ])
            void write([
              ...changed.map((b) => timeOps(b, b.start_min)),
              ...dropped.flatMap((b) =>
                writeBlockOps(
                  rowOfBlock(b) as ReturnType<typeof blockRow>,
                  b.plan_block_units.map(({ user_id: _u, ...u }) => u),
                ),
              ),
            ])
          },
        },
      )
    },
    [userId, queryClient, write, boundary, schedule, resolve, defaultId, show, t],
  )
}

/**
 * "Imam još vremena" (decision after 8b): today's plan is done and there is time left. The piece
 * `pickForTime()` chose becomes a block today from now (a manual block: the user asked for the
 * time, so replan keeps it, and it may go over the daily maximum), with a free-time exception for
 * that span in Dostupnost; the replan then counts that work as done-to-be and rearranges the
 * following days. Returns the block (to start it) and an undo.
 */
export function useAddExtraTime() {
  const save = useSaveBlock()
  const write = useQueueWrite()
  const queryClient = useQueryClient()
  const userId = useUserId()
  const boundary = useDayBoundary()
  const { resolve, defaultId } = usePresets()
  return useCallback(
    async (input: {
      subjectId: string
      kind: PlanBlockRow['kind']
      minutes: number
      unitIds: string[]
      assessmentId: string | null
      deadlineId: string | null
      mode: string
    }) => {
      const now = new Date()
      const today = localDay(now, boundary)
      const wall = wallClock(now, boundary.timeZone).minutes
      const startMin = Math.ceil((wall < boundary.dayStartMin ? wall + 1440 : wall) / 5) * 5
      const draft: BlockDraft = {
        id: crypto.randomUUID(),
        subjectId: input.subjectId,
        assessmentId: input.assessmentId,
        deadlineId: input.deadlineId,
        onDate: today,
        startMin,
        minutes: input.minutes,
        kind: input.kind,
        mode: input.mode,
        unitIds: input.unitIds,
        title: null,
        edited: false,
      }
      const exceptionId = crypto.randomUUID()
      const endMin = Math.min(1440, startMin + spanOf(resolve(defaultId), input.minutes))
      await write([
        {
          kind: 'upsert',
          table: 'availability_exceptions',
          rows: [
            {
              id: exceptionId,
              on_date: today,
              start_min: startMin,
              end_min: endMin,
              is_busy: false,
            },
          ],
        },
      ])
      void queryClient.invalidateQueries({
        queryKey: scheduleKey('availability_exceptions', userId),
      })
      const undoBlock = await save(draft)
      return {
        draft,
        undo: async () => {
          await undoBlock()
          await write([
            { kind: 'delete', table: 'availability_exceptions', match: { id: exceptionId } },
          ])
          void queryClient.invalidateQueries({
            queryKey: scheduleKey('availability_exceptions', userId),
          })
        },
      }
    },
    [save, write, queryClient, userId, boundary, resolve, defaultId],
  )
}

/** A manual block as the UrediBlok sheet edits it. */
export interface BlockDraft {
  id: string
  subjectId: string
  /** Exam the units count for (the earliest one that covers them), or the deadline. */
  assessmentId: string | null
  deadlineId: string | null
  onDate: LocalDate
  startMin: number | null
  minutes: number
  kind: PlanBlockRow['kind']
  /** Study mode chosen in the sheet (Čitanje, Zadaci…); kept in `reason`. */
  mode: string
  unitIds: string[]
  title: string | null
  /** An AI block the user changed (Satnica "Vrati predloženo" brings the plan back). */
  edited: boolean
}

function blockRow(d: BlockDraft, timeZone: string) {
  return {
    id: d.id,
    subject_id: d.subjectId,
    assessment_id: d.assessmentId,
    deadline_id: d.deadlineId,
    on_date: d.onDate,
    start_min: d.startMin,
    planned_start:
      d.startMin === null ? null : zonedInstant(d.onDate, d.startMin, timeZone).toISOString(),
    planned_minutes: d.minutes,
    kind: d.kind,
    status: 'planned' as const,
    origin: 'user' as const,
    plan_run_id: null,
    title: d.title,
    reason: JSON.stringify({ code: 'manual', mode: d.mode, ...(d.edited ? { edited: true } : {}) }),
  }
}

interface UnitRow {
  block_id: string
  unit_id: string
  page_from: number | null
  page_to: number | null
  planned_minutes: number
}

function unitRows(d: BlockDraft): UnitRow[] {
  const each = d.unitIds.length > 0 ? Math.max(1, Math.round(d.minutes / d.unitIds.length)) : 0
  return d.unitIds.map((unit_id) => ({
    block_id: d.id,
    unit_id,
    page_from: null,
    page_to: null,
    planned_minutes: each,
  }))
}

/** The ops that write a block as it was (for undo) or as the sheet left it. */
function writeBlockOps(row: ReturnType<typeof blockRow>, units: UnitRow[]): Op[] {
  return [
    { kind: 'upsert', table: 'plan_blocks', rows: [row as unknown as Row] },
    { kind: 'delete', table: 'plan_block_units', match: { block_id: row.id } },
    ...(units.length > 0
      ? [
          {
            kind: 'upsert' as const,
            table: 'plan_block_units',
            rows: units as unknown as Row[],
            onConflict: 'block_id,unit_id',
          },
        ]
      : []),
  ]
}

function rowOfBlock(b: PlanBlockRow) {
  const { plan_block_units: _units, user_id: _u, created_at: _c, updated_at: _up, ...row } = b
  return row
}

/**
 * Adding or changing a block (PRD flow 7): the block becomes manual and replan never moves or
 * deletes it; undo restores what was there. Returns an undo.
 */
export function useSaveBlock() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const write = useQueueWrite()
  const replanNow = usePlanStore((s) => s.replanNow)
  const { timezone } = useProfileZone()
  return useCallback(
    async (draft: BlockDraft) => {
      const key = planBlocksKey(userId)
      const previous = queryClient.getQueryData<PlanBlockRow[]>(key)?.find((b) => b.id === draft.id)
      const row = blockRow(draft, timezone)
      const units = unitRows(draft)
      const now = new Date().toISOString()
      queryClient.setQueryData<PlanBlockRow[]>(key, (list = []) => [
        ...list.filter((b) => b.id !== draft.id),
        {
          ...row,
          user_id: userId!,
          created_at: previous?.created_at ?? now,
          updated_at: now,
          plan_block_units: units.map((u) => ({ ...u, user_id: userId! })),
        },
      ])
      await write(writeBlockOps(row, units))
      replanNow()
      return async () => {
        if (previous) {
          queryClient.setQueryData<PlanBlockRow[]>(key, (list = []) => [
            ...list.filter((b) => b.id !== draft.id),
            previous,
          ])
          await write(
            writeBlockOps(
              rowOfBlock(previous) as ReturnType<typeof blockRow>,
              previous.plan_block_units.map(({ user_id: _u, ...u }) => u),
            ),
          )
        } else {
          queryClient.setQueryData<PlanBlockRow[]>(key, (list = []) =>
            list.filter((b) => b.id !== draft.id),
          )
          await write([{ kind: 'delete', table: 'plan_blocks', match: { id: draft.id } }])
        }
        replanNow()
      }
    },
    [userId, queryClient, write, replanNow, timezone],
  )
}

/**
 * Deleting a block: its material goes back into the pool (replan places it from tomorrow), or,
 * for "Izbaci iz plana", its units stop counting for its exam. Returns an undo.
 */
export function useDeleteBlock() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const write = useQueueWrite()
  const cut = useCutScope()
  const replanNow = usePlanStore((s) => s.replanNow)
  return useCallback(
    async (block: PlanBlockRow, drop: boolean) => {
      const key = planBlocksKey(userId)
      const exceptionsKey = scheduleKey('availability_exceptions', userId)
      // "Prebaci" (decision, Stage 8b): the AI block's time becomes busy that day, so the replan
      // places its units elsewhere instead of in the same slot again.
      const busy: ExceptionRow | null =
        !drop && block.origin === 'ai' && block.start_min !== null
          ? {
              id: crypto.randomUUID(),
              user_id: userId!,
              on_date: block.on_date,
              start_min: block.start_min,
              end_min: block.start_min + block.planned_minutes,
              is_busy: true,
              lecture_log_id: null,
              updated_at: new Date().toISOString(),
            }
          : null
      queryClient.setQueryData<PlanBlockRow[]>(key, (list = []) =>
        list.filter((b) => b.id !== block.id),
      )
      if (busy)
        queryClient.setQueryData<ExceptionRow[]>(exceptionsKey, (list = []) => [...list, busy])
      await write([
        { kind: 'delete', table: 'plan_blocks', match: { id: block.id } },
        ...(busy
          ? [
              {
                kind: 'upsert' as const,
                table: 'availability_exceptions',
                rows: [
                  {
                    id: busy.id,
                    on_date: busy.on_date,
                    start_min: busy.start_min,
                    end_min: busy.end_min,
                    is_busy: true,
                  },
                ],
              },
            ]
          : []),
      ])
      if (busy) void queryClient.invalidateQueries({ queryKey: exceptionsKey })
      if (drop && block.assessment_id)
        cut.mutate(
          block.plan_block_units.map((u) => ({ unitId: u.unit_id, goalId: block.assessment_id! })),
        )
      replanNow()
      return async () => {
        queryClient.setQueryData<PlanBlockRow[]>(key, (list = []) => [...list, block])
        if (busy)
          queryClient.setQueryData<ExceptionRow[]>(exceptionsKey, (list = []) =>
            list.filter((e) => e.id !== busy.id),
          )
        await write([
          ...writeBlockOps(
            rowOfBlock(block) as ReturnType<typeof blockRow>,
            block.plan_block_units.map(({ user_id: _u, ...u }) => u),
          ),
          ...(busy
            ? [
                {
                  kind: 'delete' as const,
                  table: 'availability_exceptions',
                  match: { id: busy.id },
                },
              ]
            : []),
        ])
        if (busy) void queryClient.invalidateQueries({ queryKey: exceptionsKey })
        replanNow()
      }
    },
    [userId, queryClient, write, cut, replanNow],
  )
}

function useProfileZone() {
  const { timeZone } = useDayBoundary()
  return { timezone: timeZone }
}

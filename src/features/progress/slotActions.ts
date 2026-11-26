import { rhythmFrom } from '@/lib/schedule/rhythm'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { syncQueueFor } from '@/app/sync'
import { useAuth } from '@/features/auth/auth-context'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { scheduleKey } from '@/features/schedule/api'
import { toRule, toStoredSlots, type RuleRow, type DayRow } from '@/features/schedule/model'
import { usePlanStore } from '@/features/plan/store'
import { useDayBoundary, useProfile } from '@/features/settings/profile'
import { localDay, weekdayOf } from '@/lib/day'
import { slotsFor } from '@/lib/schedule'
import { editWeeklySlots } from '@/lib/slots/availability'
import type { StrategistAction } from '@/lib/strategist'
import type { Op } from '@/lib/sync'

export type SlotAction = Extract<StrategistAction, { kind: 'avoid_slot' | 'add_slot' }>
export function useApplySlot() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  const schedule = useScheduleData()
  const boundary = useDayBoundary()
  const profile = useProfile().data
  const replan = usePlanStore((s) => s.replanNow)
  return useMutation({
    mutationFn: async (action: SlotAction) => {
      if (!userId) throw new Error('Authentication required')
      const today = localDay(new Date(), boundary)
      const now = new Date().toISOString()
      const affected = (weekday: number) => weekday >= 5 === action.weekend
      const removed = schedule.ruleRows.filter((r) => affected(r.weekday))
      const next = editWeeklySlots(
        schedule.ruleRows.map(toRule),
        action,
        rhythmFrom(profile),
      ).filter((r) => affected(r.weekday))
      const rows: RuleRow[] = next.map((r) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        weekday: r.weekday,
        start_min: r.startMin,
        end_min: r.endMin,
        over_classes: r.overClasses ?? false,
        updated_at: now,
      }))
      const previous = schedule.dayRows.find((d) => d.on_date === today)
      const snapshot: DayRow | null =
        affected(weekdayOf(today)) && previous?.slots == null
          ? {
              id: previous?.id ?? crypto.randomUUID(),
              user_id: userId,
              on_date: today,
              slots: toStoredSlots(slotsFor(today, schedule.dayInput(today))).map((s) => ({
                ...s,
              })),
              cap_min: previous?.cap_min ?? null,
              created_at: previous?.created_at ?? now,
              updated_at: now,
            }
          : null
      const ops: Op[] = [
        ...(snapshot
          ? [{ kind: 'upsert' as const, table: 'availability_days', rows: [snapshot] }]
          : []),
        ...removed.map((r) => ({
          kind: 'delete' as const,
          table: 'availability_rules',
          match: { id: r.id },
        })),
        ...(rows.length ? [{ kind: 'upsert' as const, table: 'availability_rules', rows }] : []),
      ]
      const queue = syncQueueFor(userId)
      await queue.enqueue(...ops)
      queryClient.setQueryData<RuleRow[]>(scheduleKey('availability_rules', userId), [
        ...schedule.ruleRows.filter((r) => !affected(r.weekday)),
        ...rows,
      ])
      if (snapshot)
        queryClient.setQueryData<DayRow[]>(scheduleKey('availability_days', userId), [
          ...schedule.dayRows.filter((d) => d.on_date !== today),
          snapshot,
        ])
      if (navigator.onLine) await queue.flush()
      replan()
      // What puts the week back as it was ("Vrati odluku" on Prijedlozi).
      const revert: Op[] = [
        ...rows.map((r) => ({
          kind: 'delete' as const,
          table: 'availability_rules',
          match: { id: r.id },
        })),
        ...(removed.length
          ? [{ kind: 'upsert' as const, table: 'availability_rules', rows: removed }]
          : []),
        ...(snapshot
          ? [
              previous
                ? {
                    kind: 'upsert' as const,
                    table: 'availability_days',
                    rows: [{ ...previous }],
                  }
                : {
                    kind: 'delete' as const,
                    table: 'availability_days',
                    match: { id: snapshot.id },
                  },
            ]
          : []),
      ]
      return revert
    },
  })
}

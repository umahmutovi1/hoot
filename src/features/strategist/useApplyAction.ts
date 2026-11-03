import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { usePatchSubject, useRaiseCaps, useCutScope, useSaveBlock } from '@/features/plan/actions'
import { invalidatePlanInputs } from '@/features/plan/api'
import { usePlanStore } from '@/features/plan/store'
import { useUpdateProfile } from '@/features/settings/profile'
import { useAuth } from '@/features/auth/auth-context'
import { useApplySlot } from '@/features/progress/slotActions'
import { useProgress } from '@/features/progress/useProgress'
import { addDays } from '@/lib/day'
import { PART_RANGES } from '@/lib/schedule/rhythm'
import { supabase } from '@/lib/supabase'
import type { StrategistAction } from '@/lib/strategist'
import type { InsightAction } from '@/lib/insights'
import { usePresets } from '@/features/session/presets'
import { MAX_CUSTOM_PRESETS } from '@shared/schemas.ts'

/** Sprint 17: user approval changes inputs, never asks the model to write plan blocks. */
export function useApplyAction() {
  const data = useProgress()
  const { t } = useTranslation()
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  const subject = usePatchSubject(),
    caps = useRaiseCaps(),
    scope = useCutScope(),
    profile = useUpdateProfile(),
    slot = useApplySlot()
  const saveBlock = useSaveBlock()
  const presets = usePresets()
  const replan = usePlanStore((s) => s.replanNow)
  return useMutation({
    mutationFn: async (action: StrategistAction | InsightAction) => {
      if (!data) throw new Error(t('strategist.notReady'))
      const today = data.today
      switch (action.kind) {
        case 'set_priority':
          await subject.mutateAsync({ id: action.subjectId, patch: { priority: action.priority } })
          break
        case 'boost_priority':
          await subject.mutateAsync({
            id: action.subjectId,
            patch: { priority_boost_until: action.until },
          })
          break
        case 'set_mode':
          await subject.mutateAsync({ id: action.subjectId, patch: { study_mode: action.mode } })
          break
        case 'set_campaign_start':
          await subject.mutateAsync({
            id: action.subjectId,
            patch: { study_mode: 'campaign', campaign_start_on: action.start },
          })
          break
        case 'change_buffer':
          await profile.mutateAsync({ buffer_days: action.days })
          break
        case 'add_hours':
          await caps.mutateAsync({
            from: addDays(today, 1),
            until: action.until,
            cap: (previous) => Math.min(1440, previous + action.minutesPerDay),
          })
          break
        case 'drop_unit':
          await scope.mutateAsync(
            action.unitIds.map((unitId) => ({ unitId, goalId: action.goalId })),
          )
          break
        case 'reprioritize_unit': {
          const { error } = await supabase
            .from('units')
            .update({ next_review_on: today })
            .in('id', action.unitIds)
            .or(`next_review_on.is.null,next_review_on.gt.${today}`)
          if (error) throw error
          await invalidatePlanInputs(queryClient, userId)
          break
        }
        case 'avoid_slot':
        case 'add_slot':
          await slot.mutateAsync(action)
          break
        case 'set_preset': {
          if (presets.custom.length >= MAX_CUSTOM_PRESETS)
            throw new Error(t('progress.rhythm.full'))
          const id = `custom:${crypto.randomUUID()}`
          await profile.mutateAsync({
            default_preset: id,
            session_presets: [
              ...presets.custom,
              {
                id,
                name: t('progress.rhythm.name', action),
                steps: [
                  { kind: 'work', min: action.workMin },
                  { kind: 'break', min: action.breakMin },
                ],
                long_break: null,
              },
            ],
          })
          break
        }
        case 'first_step': {
          const on = 'on' in action ? action.on : addDays(today, 1)
          const day = data.model.built.state.days.find((d) => d.date === on)
          const range = 'part' in action ? PART_RANGES[action.part] : { startMin: 0, endMin: 1440 }
          const free = day?.slots
            .map((s) => ({
              startMin: Math.max(s.startMin, range.startMin),
              endMin: Math.min(s.endMin, range.endMin),
            }))
            .find((s) => s.endMin - s.startMin >= 15)
          if (!free) throw new Error(t('strategist.noFirstSlot'))
          const goal = data.model.built.state.goals.find(
            (g) => g.subjectId === action.subjectId && g.kind === 'exam',
          )
          const unit = data.model.built.state.units
            .filter((u) => u.subjectId === action.subjectId && u.level < 3)
            .sort((a, b) => a.order - b.order)[0]
          await saveBlock({
            id: crypto.randomUUID(),
            subjectId: action.subjectId,
            assessmentId: goal?.id ?? null,
            deadlineId: null,
            onDate: on,
            startMin: free.startMin,
            minutes: 15,
            kind: 'learn',
            mode: 'reading',
            unitIds: unit ? [unit.id] : [],
            title: t('strategist.firstStep'),
            edited: false,
          })
          break
        }
        case 'end_by': {
          const rows = []
          for (let on = addDays(today, 1); on < action.until; on = addDays(on, 1))
            rows.push({
              id: crypto.randomUUID(),
              on_date: on,
              start_min: action.untilMin,
              end_min: 1440,
              is_busy: true,
            })
          if (rows.length) {
            const { error } = await supabase.from('availability_exceptions').upsert(rows)
            if (error) throw error
          }
          await queryClient.invalidateQueries({ queryKey: ['availability_exceptions'] })
          break
        }
        // These two are persisted feedback inputs: the gate / scheduler read the accepted event.
        case 'strict_recall_gate':
        case 'questions_next':
          break
      }
      replan()
    },
  })
}

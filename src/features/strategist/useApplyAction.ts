import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  usePatchSubject,
  useRaiseCaps,
  useCutScope,
  useSaveBlock,
  useQueueWrite,
} from '@/features/plan/actions'
import { invalidatePlanInputs } from '@/features/plan/api'
import { usePlanStore } from '@/features/plan/store'
import { useUpdateProfile } from '@/features/settings/profile'
import { useAuth } from '@/features/auth/auth-context'
import { useApplySlot } from '@/features/progress/slotActions'
import { useProgress } from '@/features/progress/useProgress'
import { addDays } from '@/lib/day'
import { PART_RANGES } from '@/lib/schedule/rhythm'
import type { StrategistAction } from '@/lib/strategist'
import type { InsightAction } from '@/lib/insights'
import { usePresets } from '@/features/session/presets'
import { MAX_CUSTOM_PRESETS } from '@shared/schemas.ts'
import type { Op } from '@/lib/sync'
import type { SubjectWithAssessments } from '@/features/subjects/model'

type SubjectFields = Pick<
  SubjectWithAssessments,
  'priority' | 'priority_boost_until' | 'study_mode' | 'campaign_start_on'
>

/**
 * Sprint 17: user approval changes inputs, never asks the model to write plan blocks. Resolves
 * to the writes that put the inputs back as they were ("Vrati odluku" on Prijedlozi).
 */
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
  const write = useQueueWrite()
  const presets = usePresets()
  const replan = usePlanStore((s) => s.replanNow)
  return useMutation({
    mutationFn: async (action: StrategistAction | InsightAction): Promise<Op[]> => {
      if (!data) throw new Error(t('strategist.notReady'))
      const today = data.today
      let revert: Op[] = []
      const subjectBack = (id: string, fields: (keyof SubjectFields)[]) => {
        const before = data.inputs.subjects.find((s) => s.id === id)
        if (!before) return []
        const patch = Object.fromEntries(fields.map((f) => [f, before[f]]))
        return [{ kind: 'update', table: 'subjects', match: { id }, patch } satisfies Op]
      }
      const profileBack = (fields: (keyof typeof data.inputs.profile)[]): Op[] => [
        {
          kind: 'update',
          table: 'profiles',
          match: { id: data.inputs.profile.id },
          patch: Object.fromEntries(fields.map((f) => [f, data.inputs.profile[f]])),
        },
      ]
      switch (action.kind) {
        case 'set_priority':
          revert = subjectBack(action.subjectId, ['priority'])
          await subject.mutateAsync({ id: action.subjectId, patch: { priority: action.priority } })
          break
        case 'boost_priority':
          revert = subjectBack(action.subjectId, ['priority_boost_until'])
          await subject.mutateAsync({
            id: action.subjectId,
            patch: { priority_boost_until: action.until },
          })
          break
        case 'set_mode':
          revert = subjectBack(action.subjectId, ['study_mode'])
          await subject.mutateAsync({ id: action.subjectId, patch: { study_mode: action.mode } })
          break
        case 'set_campaign_start':
          revert = subjectBack(action.subjectId, ['study_mode', 'campaign_start_on'])
          await subject.mutateAsync({
            id: action.subjectId,
            patch: { study_mode: 'campaign', campaign_start_on: action.start },
          })
          break
        case 'change_buffer':
          revert = profileBack(['buffer_days'])
          await profile.mutateAsync({ buffer_days: action.days })
          break
        case 'add_hours':
          revert = await caps.mutateAsync({
            from: addDays(today, 1),
            until: action.until,
            cap: (previous) => Math.min(1440, previous + action.minutesPerDay),
          })
          break
        case 'drop_unit':
          revert = action.unitIds.map((unitId): Op => {
            const before = data.inputs.scope.find(
              (r) => r.assessment_id === action.goalId && r.unit_id === unitId,
            )
            return before
              ? {
                  kind: 'upsert',
                  table: 'assessment_units',
                  rows: [
                    {
                      assessment_id: before.assessment_id,
                      unit_id: before.unit_id,
                      included: before.included,
                      assigned_by: before.assigned_by,
                    },
                  ],
                  onConflict: 'assessment_id,unit_id',
                }
              : {
                  kind: 'delete',
                  table: 'assessment_units',
                  match: { assessment_id: action.goalId, unit_id: unitId },
                }
          })
          await scope.mutateAsync(
            action.unitIds.map((unitId) => ({ unitId, goalId: action.goalId })),
          )
          break
        case 'reprioritize_unit': {
          const due = new Map(data.model.built.state.units.map((u) => [u.id, u.nextReviewOn]))
          const moved = action.unitIds.filter((id) => {
            const next = due.get(id)
            return next === null || (next !== undefined && next > today)
          })
          revert = moved.map((id) => ({
            kind: 'update' as const,
            table: 'units',
            match: { id },
            patch: { next_review_on: due.get(id) ?? null },
          }))
          await write(
            moved.map((id) => ({
              kind: 'update' as const,
              table: 'units',
              match: { id },
              patch: { next_review_on: today },
            })),
          )
          await invalidatePlanInputs(queryClient, userId)
          break
        }
        case 'avoid_slot':
        case 'add_slot':
          revert = await slot.mutateAsync(action)
          break
        case 'set_preset': {
          revert = profileBack(['default_preset', 'session_presets'])
          const id = `custom:rhythm-${action.workMin}-${action.breakMin}`
          if (presets.custom.some((p) => p.id === id)) {
            await profile.mutateAsync({ default_preset: id })
            break
          }
          if (presets.custom.length >= MAX_CUSTOM_PRESETS)
            throw new Error(t('progress.rhythm.full'))
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
          const blockId = crypto.randomUUID()
          revert = [{ kind: 'delete', table: 'plan_blocks', match: { id: blockId } }]
          await saveBlock({
            id: blockId,
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
          revert = rows.map((r) => ({
            kind: 'delete' as const,
            table: 'availability_exceptions',
            match: { id: r.id },
          }))
          if (rows.length) await write([{ kind: 'upsert', table: 'availability_exceptions', rows }])
          await queryClient.invalidateQueries({ queryKey: ['availability_exceptions'] })
          break
        }
        // These two are persisted feedback inputs: the gate / scheduler read the accepted event.
        case 'strict_recall_gate':
        case 'questions_next':
          break
      }
      replan()
      return revert
    },
  })
}

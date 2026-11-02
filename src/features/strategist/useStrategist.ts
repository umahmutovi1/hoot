import { useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { strategistOutputSchema, strategistRequestSchema } from '@shared/schemas.ts'
import { useProgress } from '@/features/progress/useProgress'
import { useLocale } from '@/features/settings/useLocale'
import { invokeAi } from '@/features/owl/api'
import { candidates } from '@/lib/strategist'
import { diffDays, localDay } from '@/lib/day'
import { actionLabel } from './copy'
import { latestFeedback, useFeedback, useRecordFeedback } from './feedback'
import { useInsightData } from './useInsights'
import { weekWindow } from '@/lib/progress/week'

export function useStrategist() {
  const data = useProgress(),
    insight = useInsightData(),
    feedback = useFeedback(),
    record = useRecordFeedback()
  const { locale } = useLocale(),
    { t } = useTranslation()
  const list = useMemo(() => {
    if (!data) return []
    return candidates({
      state: data.model.built.state,
      result: data.model.result,
      today: data.today,
      behind: data.model.built.behind,
      slots: data.signals,
      slotCompletion: data.model.built.state.slotCompletion ?? null,
      avoided: insight?.list.filter((i) => i.kind === 'avoidance').map((i) => i.subjectId) ?? [],
    }).filter((c) => {
      const previous = latestFeedback(feedback.data ?? [], c.id)
      return (
        !previous ||
        diffDays(
          localDay(new Date(previous.created_at), {
            timeZone: data.inputs.profile.timezone,
            dayStartMin: data.inputs.profile.day_start_min,
          }),
          data.today,
        ) > 14
      )
    })
  }, [data, insight, feedback.data])
  const week = data ? weekWindow(data.today).nextFrom : ''
  const key = `strategist:${week}`
  const cached = latestFeedback(feedback.data ?? [], key)
  const payload = cached?.payload
  const stored =
    payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.output : null
  const allIds = list.map((c) => c.id)
  const savedIds =
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Array.isArray(payload.candidate_ids)
      ? payload.candidate_ids.filter((id): id is string => typeof id === 'string')
      : allIds
  const parsed = savedIds.length
    ? strategistOutputSchema(savedIds as [string, ...string[]]).safeParse(stored)
    : null
  const generate = useMutation({
    meta: { silent: true },
    mutationFn: async () => {
      if (!data || !list.length) return null
      const state = data.model.built.state
      const request = strategistRequestSchema.parse({
        locale,
        week,
        rho: state.rho,
        subjects: data.inputs.subjects
          .filter((s) => !s.archived)
          .map((s) => ({
            id: s.id,
            name: s.name,
            priority: s.priority,
            mode: s.study_mode,
            progress: data.progress(
              state.units.filter((u) => u.subjectId === s.id).map((u) => u.id),
            ).fraction,
            strength: data.strength(
              state.units.filter((u) => u.subjectId === s.id).map((u) => u.id),
            ),
            behind_minutes:
              data.model.built.behind.find((b) => b.subjectId === s.id)?.behindMinutes ?? 0,
          })),
        goals: data.forecasts.map((f) => ({
          id: f.goalId,
          subject_id: f.subject.id,
          on: f.goal.on,
          low: f.coverage.p10,
          high: f.coverage.p90,
          probability: f.pRequired,
        })),
        candidates: list.map((c) => ({
          id: c.id,
          kind: c.action.kind,
          label: actionLabel(
            t,
            c.action,
            'subjectId' in c.action
              ? data.inputs.subjects.find(
                  (s) => s.id === ('subjectId' in c.action ? c.action.subjectId : null),
                )?.name
              : '',
          ),
          deficit_before: c.effect?.deficitBefore ?? null,
          deficit_after: c.effect?.deficitAfter ?? null,
          week_minutes: Object.entries(c.effect?.weekMinutes ?? {}).map(
            ([subject_id, minutes]) => ({ subject_id, minutes }),
          ),
        })),
      })
      const response = await invokeAi<unknown>('strategist', request)
      const output = strategistOutputSchema(allIds as [string, ...string[]]).parse(response)
      await record.mutateAsync({
        insightId: key,
        status: 'accepted',
        payload: { kind: 'strategist', output, candidate_ids: allIds, input_hash: data.model.hash },
      })
      return output
    },
  })
  const output = generate.data ?? (parsed?.success ? parsed.data : null)
  const sameInput =
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    payload.input_hash === data?.model.hash
  const actionOutput = sameInput ? output : null
  return {
    list,
    output,
    generate,
    week,
    cached,
    selected: actionOutput
      ? actionOutput.actions.flatMap((a) => {
          const c = list.find((c) => c.id === a.candidate_id)
          return c ? [{ ...c, reason: a.reason }] : []
        })
      : list.slice(0, 3).map((c) => ({ ...c, reason: null })),
  }
}

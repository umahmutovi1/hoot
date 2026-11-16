import { supabase } from '@/lib/supabase'
import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { strategistOutputSchema, strategistRequestSchema } from '@shared/schemas.ts'
import { useProgress } from '@/features/progress/useProgress'
import { useLocale } from '@/features/settings/useLocale'
import { invokeAi } from '@/features/owl/api'
import { candidates } from '@/lib/strategist'
import { diffDays, localDay } from '@/lib/day'
import { actionLabel } from './copy'
import { isReverted, latestFeedback, useFeedback, useRecordFeedback } from './feedback'
import { useInsightData } from './useInsights'
import { weekWindow } from '@/lib/progress/week'

export function useStrategist() {
  const data = useProgress(),
    insight = useInsightData(),
    feedback = useFeedback(),
    record = useRecordFeedback()
  const { locale } = useLocale(),
    { t } = useTranslation()
  const topics = useQuery({
    queryKey: ['progress', data?.inputs.profile.id, 'topics'],
    enabled: Boolean(data),
    queryFn: async () => {
      const { data, error } = await supabase.from('topics').select('*')
      if (error) throw error
      return data
    },
  })
  const list = useMemo(() => {
    if (!data) return []
    return candidates({
      state: data.model.built.state,
      result: data.model.result,
      today: data.today,
      behind: data.model.built.behind,
      slots: data.signals,
      slotCompletion: data.model.built.state.slotCompletion ?? null,
      rhythm:
        latestFeedback(feedback.data ?? [], 'first_break')?.status === 'not_useful'
          ? null
          : insight?.input.rhythm,
      avoided: insight?.list.filter((i) => i.kind === 'avoidance').map((i) => i.subjectId) ?? [],
    }).filter((c) => {
      const previous = latestFeedback(feedback.data ?? [], c.id)
      return (
        !previous ||
        isReverted(previous) ||
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
      if (!data || !list.length || !topics.data) return null
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
        topics: topics.data
          .map((topic) => {
            const linked = new Set(
              data.inputs.unitTopics.filter((l) => l.topic_id === topic.id).map((l) => l.unit_id),
            )
            const all = new Map(
              data.inputs.sources.flatMap((s) => s.units.map((u) => [u.id, u] as const)),
            )
            const ids = state.units
              .filter((u) => {
                let id: string | null = u.id
                const seen = new Set<string>()
                while (id && !seen.has(id)) {
                  if (linked.has(id)) return true
                  seen.add(id)
                  id = all.get(id)?.parent_id ?? null
                }
                return false
              })
              .map((u) => u.id)
            return {
              id: topic.id,
              subject_id: topic.subject_id,
              name: topic.name,
              strength: data.strength(ids),
              progress: data.progress(ids).fraction,
            }
          })
          .sort((a, b) => (a.strength ?? 2) - (b.strength ?? 2))
          .slice(0, 12),
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
    canGenerate: Boolean(topics.data),
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

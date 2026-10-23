import { useQuery, type QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useSessions } from '@/features/session/api'
import { toSegment } from '@/features/session/model'
import { useGlobalScale, useProfile } from '@/features/settings/profile'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { speedOf, type AssessmentUnit, type SourceWithUnits } from '@/features/sources/model'
import { addDays, localDay, type DayBoundary } from '@/lib/day'
import { activeMs, MINUTE } from '@/lib/session/timer'
import { supabase } from '@/lib/supabase'
import type { CardReview, PlanBlockRow, PlanInputs, SessionMinutes } from './state'

// Plan data: every source, scope row and topic link of the user (the plan spans subjects), the
// blocks from two weeks ago on (history for ρ) and the latest plan run.

export const planKey = (userId: string | undefined) => ['plan', userId] as const
export const planBlocksKey = (userId: string | undefined) => ['plan', userId, 'blocks'] as const
export const planRunKey = (userId: string | undefined) => ['plan', userId, 'run'] as const
const allSourcesKey = (userId: string | undefined) => ['plan', userId, 'sources'] as const
const allScopeKey = (userId: string | undefined) => ['plan', userId, 'scope'] as const
const topicLinksKey = (userId: string | undefined) => ['plan', userId, 'topics'] as const
export const cardReviewsKey = (userId: string | undefined) => ['plan', userId, 'cards'] as const

/** History window for ρ (14 days) plus a day of slack around the day boundary. */
const HISTORY_DAYS = 15

function useUserId() {
  return useAuth().session?.user.id
}

export function useAllSources() {
  const userId = useUserId()
  return useQuery({
    queryKey: allSourcesKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<SourceWithUnits[]> => {
      const { data, error } = await supabase
        .from('sources')
        .select('*, units(*)')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

function useAllScope() {
  const userId = useUserId()
  return useQuery({
    queryKey: allScopeKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<AssessmentUnit[]> => {
      const { data, error } = await supabase.from('assessment_units').select('*')
      if (error) throw error
      return data
    },
  })
}

export function useTopicLinks() {
  const userId = useUserId()
  return useQuery({
    queryKey: topicLinksKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('unit_topics').select('unit_id, topic_id')
      if (error) throw error
      return data
    },
  })
}

/** Every card in review (its unit, due day and memory), for review blocks and strength. */
export function useCardReviews() {
  const userId = useUserId()
  return useQuery({
    queryKey: cardReviewsKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<CardReview[]> => {
      const { data, error } = await supabase
        .from('cards')
        .select(
          'id, unit_id, next_review_on, fsrs_stability, fsrs_difficulty, fsrs_state, fsrs_reps, fsrs_lapses, review_streak, last_review_at',
        )
      if (error) throw error
      return data
    },
  })
}

export function usePlanBlocks(boundary: DayBoundary) {
  const userId = useUserId()
  return useQuery({
    queryKey: planBlocksKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<PlanBlockRow[]> => {
      const since = addDays(localDay(new Date(), boundary), -HISTORY_DAYS)
      const { data, error } = await supabase
        .from('plan_blocks')
        .select('*, plan_block_units(*)')
        .gte('on_date', since)
        .order('on_date')
        .order('start_min', { nullsFirst: false })
      if (error) throw error
      return data
    },
  })
}

export interface PlanRun {
  id: string
  input_hash: string
  deficit: unknown
  created_at: string
}

export function usePlanRun() {
  const userId = useUserId()
  return useQuery({
    queryKey: planRunKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<PlanRun | null> => {
      const { data, error } = await supabase
        .from('plan_runs')
        .select('id, input_hash, deficit, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Plan queries refetch after any change elsewhere (their keys span subjects). */
export function invalidatePlanInputs(queryClient: QueryClient, userId: string | undefined) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: allSourcesKey(userId) }),
    queryClient.invalidateQueries({ queryKey: allScopeKey(userId) }),
    queryClient.invalidateQueries({ queryKey: topicLinksKey(userId) }),
    queryClient.invalidateQueries({ queryKey: cardReviewsKey(userId) }),
  ])
}

/** Everything `buildPlanState()` needs; null until every query has data. */
export function usePlanInputs(boundary: DayBoundary): PlanInputs | null {
  const profile = useProfile().data
  const subjects = useSubjects().data
  const deadlines = useDeadlines().data
  const sources = useAllSources().data
  const scope = useAllScope().data
  const unitTopics = useTopicLinks().data
  const cards = useCardReviews().data
  const blocks = usePlanBlocks(boundary).data
  const sessionList = useSessions().data
  const scale = useGlobalScale()
  // A new object on every render would restart the replan debounce forever.
  const pointsTotal = scale?.points_total
  const gradeScale = scale?.grade_scale
  const globalScale = useMemo(
    () =>
      pointsTotal === undefined
        ? undefined
        : { points_total: pointsTotal, grade_scale: gradeScale },
    [pointsTotal, gradeScale],
  )
  const schedule = useScheduleData()

  return useMemo(() => {
    if (
      !profile ||
      !subjects ||
      !deadlines ||
      !sources ||
      !scope ||
      !unitTopics ||
      !cards ||
      !blocks ||
      !sessionList
    )
      return null
    const sessions: SessionMinutes[] = sessionList
      .filter((s) => s.ended_at)
      .map((s) => ({
        startedAt: s.started_at,
        blockId: s.block_id,
        minutes: Math.round(
          activeMs(s.study_segments.map(toSegment), new Date(s.ended_at!)) / MINUTE,
        ),
      }))
    return {
      profile,
      subjects,
      deadlines,
      sources,
      scope,
      unitTopics,
      cards,
      logs: schedule.logRows,
      blocks,
      sessions,
      globalScale,
      dayInput: schedule.dayInput,
    }
  }, [
    profile,
    subjects,
    deadlines,
    sources,
    scope,
    unitTopics,
    cards,
    blocks,
    sessionList,
    globalScale,
    schedule,
  ])
}

/** Personal speed factor of every source (PRD "Procjena" → 5), for estimates on screens. */
export function useSpeeds(): Map<string, number> {
  const sources = useAllSources().data
  return useMemo(
    () => new Map((sources ?? []).map((s) => [s.id, speedOf(s, sources ?? [])])),
    [sources],
  )
}

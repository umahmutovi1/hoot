import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'
import type { MergeResult } from '@/lib/outline/merge'
import type { Measure } from '@/lib/outline/parse'
import type { ScopeRow } from '@/lib/progress/scope'
import { toSourceRow, toUnitRows } from './mappers'
import type {
  AssessmentUnit,
  Card,
  SourceWithUnits,
  TopicWithUnits,
  Unit,
  UnitTopic,
} from './model'
import type { CardForm, SourceForm } from './schemas'

// IDs come from the client (crypto.randomUUID()), so writes are idempotent upserts that the
// offline queue (Stage 6) can replay.

export const sourcesKey = (userId: string | undefined, subjectId: string | undefined) =>
  ['sources', userId, subjectId] as const
export const scopeKey = (userId: string | undefined, subjectId: string | undefined) =>
  ['scope', userId, subjectId] as const
export const topicsKey = (userId: string | undefined, subjectId: string | undefined) =>
  ['topics', userId, subjectId] as const
export const cardsKey = (userId: string | undefined, unitId: string | undefined) =>
  ['cards', userId, unitId] as const

function useUserId() {
  return useAuth().session?.user.id
}

/** Optimistically patch a cached list; returns a rollback for onError. */
async function patchList<T>(
  queryClient: QueryClient,
  key: readonly unknown[],
  patch: (list: T[]) => T[],
) {
  await queryClient.cancelQueries({ queryKey: key })
  const previous = queryClient.getQueryData<T[]>(key)
  queryClient.setQueryData<T[]>(key, (old) => patch(old ?? []))
  return () => queryClient.setQueryData(key, previous)
}

const now = () => new Date().toISOString()

// ---------------------------------------------------------------- sources and units

export function useSources(subjectId: string | undefined) {
  const userId = useUserId()
  return useQuery({
    queryKey: sourcesKey(userId, subjectId),
    enabled: Boolean(userId && subjectId),
    queryFn: async (): Promise<SourceWithUnits[]> => {
      const { data, error } = await supabase
        .from('sources')
        .select('*, units(*)')
        .eq('subject_id', subjectId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useSource(subjectId: string | undefined, sourceId: string | undefined) {
  const query = useSources(subjectId)
  return { ...query, data: query.data?.find((s) => s.id === sourceId) }
}

export interface SaveOutlineInput {
  form: SourceForm
  measure: Measure
  merge: MergeResult
}

/** Saves a source together with its reviewed outline: upsert units, archive the missing ones. */
export function useSaveOutline() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ form, measure, merge }: SaveOutlineInput) => {
      const { error } = await supabase.from('sources').upsert(toSourceRow(form))
      if (error) throw error
      const rows = toUnitRows(form.id, measure, merge.units)
      // Parents come before their children, and FK checks run at the end of the statement.
      if (rows.length > 0) {
        const { error: uError } = await supabase.from('units').upsert(rows)
        if (uError) throw uError
      }
      if (merge.archive.length > 0) {
        const { error: aError } = await supabase
          .from('units')
          .update({ archived_at: now() })
          .in(
            'id',
            merge.archive.map((u) => u.id),
          )
        if (aError) throw aError
      }
    },
    onMutate: ({ form, measure, merge }) =>
      patchList<SourceWithUnits>(queryClient, sourcesKey(userId, form.subjectId), (list) => {
        const old = list.find((s) => s.id === form.id)
        const archivedIds = new Set(merge.archive.map((u) => u.id))
        const rows = new Map(toUnitRows(form.id, measure, merge.units).map((r) => [r.id!, r]))
        const meta = { user_id: userId!, created_at: now(), updated_at: now() }
        const units: Unit[] = [
          ...(old?.units ?? []).map((u) =>
            archivedIds.has(u.id) ? { ...u, archived_at: now() } : u,
          ),
        ]
        for (const [id, row] of rows) {
          const i = units.findIndex((u) => u.id === id)
          const next = { ...emptyUnit(meta), ...(i >= 0 ? units[i] : {}), ...row, id } as Unit
          if (i >= 0) units[i] = next
          else units.push(next)
        }
        const source = {
          learned_min_per_unit: null,
          learned_samples: 0,
          measured_sessions: 0,
          is_rough: false,
          author: null,
          weight: null,
          ...meta,
          ...old,
          ...toSourceRow(form),
          units,
        } as SourceWithUnits
        return old ? list.map((s) => (s.id === form.id ? source : s)) : [...list, source]
      }),
    onError: (_error, _input, rollback) => rollback?.(),
    onSettled: (_data, _error, { form }) =>
      queryClient.invalidateQueries({ queryKey: sourcesKey(userId, form.subjectId) }),
  })
}

function emptyUnit(meta: { user_id: string; created_at: string; updated_at: string }) {
  return {
    ...meta,
    parent_id: null,
    label: null,
    page_start: null,
    page_end: null,
    amount: 1,
    ai_difficulty: null,
    user_difficulty: null,
    est_minutes: null,
    level: 0,
    confidence: null,
    notes: null,
    answer: null,
    answer_origin: null,
    completed_at: null,
    srs_ease: 2.5,
    srs_interval_days: null,
    srs_success_count: 0,
    next_review_on: null,
    archived_at: null,
  } satisfies Omit<Unit, 'id' | 'source_id' | 'kind' | 'position' | 'title'>
}

export type UnitPatch = Pick<
  TablesUpdate<'units'>,
  | 'level'
  | 'user_difficulty'
  | 'notes'
  | 'answer'
  | 'answer_origin'
  | 'archived_at'
  | 'label'
  | 'title'
  | 'page_start'
  | 'page_end'
  | 'amount'
  | 'completed_at'
>

/** Partial update of one unit (status, rating, notes, answer, archive, title/pages). */
export function useUpdateUnit(subjectId: string | undefined) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UnitPatch }) => {
      const { error } = await supabase.from('units').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, patch }) =>
      patchList<SourceWithUnits>(queryClient, sourcesKey(userId, subjectId), (list) =>
        list.map((s) => ({
          ...s,
          units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        })),
      ),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sourcesKey(userId, subjectId) }),
  })
}

export function useDeleteSource(subjectId: string | undefined) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sources').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) =>
      patchList<SourceWithUnits>(queryClient, sourcesKey(userId, subjectId), (list) =>
        list.filter((s) => s.id !== id),
      ),
    onError: (_error, _id, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sourcesKey(userId, subjectId) }),
  })
}

// ---------------------------------------------------------------- exam scope

export function useScope(subjectId: string | undefined) {
  const userId = useUserId()
  return useQuery({
    queryKey: scopeKey(userId, subjectId),
    enabled: Boolean(userId && subjectId),
    queryFn: async (): Promise<AssessmentUnit[]> => {
      const { data, error } = await supabase
        .from('assessment_units')
        .select('*, assessments!inner(subject_id)')
        .eq('assessments.subject_id', subjectId!)
      if (error) throw error
      return data.map(({ assessments: _a, ...row }) => row)
    },
  })
}

export interface SaveScopeInput {
  /** Units whose rows are replaced. */
  unitIds: string[]
  /** All of the subject's exams; rows of other exams are never touched. */
  examIds: string[]
  /** The new rows for those units (already `rowsForChoice`). */
  rows: ScopeRow[]
}

/** Replaces the scope rows of the given units; every row is a manual (`user`) choice. */
export function useSaveScope(subjectId: string | undefined) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const toRow = (r: ScopeRow): TablesInsert<'assessment_units'> => ({
    assessment_id: r.assessmentId,
    unit_id: r.unitId,
    included: r.included,
    assigned_by: 'user',
  })
  return useMutation({
    mutationFn: async ({ unitIds, examIds, rows }: SaveScopeInput) => {
      if (unitIds.length === 0 || examIds.length === 0) return
      const { error } = await supabase
        .from('assessment_units')
        .delete()
        .in('unit_id', unitIds)
        .in('assessment_id', examIds)
      if (error) throw error
      if (rows.length > 0) {
        const { error: iError } = await supabase.from('assessment_units').insert(rows.map(toRow))
        if (iError) throw iError
      }
    },
    onMutate: ({ unitIds, examIds, rows }) =>
      patchList<AssessmentUnit>(queryClient, scopeKey(userId, subjectId), (list) => [
        ...list.filter((r) => !(unitIds.includes(r.unit_id) && examIds.includes(r.assessment_id))),
        ...rows.map((r) => ({ ...toRow(r), user_id: userId! }) as AssessmentUnit),
      ]),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: scopeKey(userId, subjectId) }),
  })
}

// ---------------------------------------------------------------- topics

export function useTopics(subjectId: string | undefined) {
  const userId = useUserId()
  return useQuery({
    queryKey: topicsKey(userId, subjectId),
    enabled: Boolean(userId && subjectId),
    queryFn: async (): Promise<TopicWithUnits[]> => {
      const { data, error } = await supabase
        .from('topics')
        .select('*, unit_topics(*)')
        .eq('subject_id', subjectId!)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

/** Adds or removes a topic on a unit; a new topic name creates the topic first. */
export function useSetUnitTopic(subjectId: string | undefined) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      unitId,
      topic,
      on,
    }: {
      unitId: string
      topic: { id: string; name: string; isNew: boolean }
      on: boolean
    }) => {
      if (topic.isNew) {
        const { error } = await supabase
          .from('topics')
          .upsert({ id: topic.id, subject_id: subjectId!, name: topic.name })
        if (error) throw error
      }
      const { error } = on
        ? await supabase
            .from('unit_topics')
            .upsert({ unit_id: unitId, topic_id: topic.id, assigned_by: 'user' })
        : await supabase.from('unit_topics').delete().eq('unit_id', unitId).eq('topic_id', topic.id)
      if (error) throw error
    },
    onMutate: ({ unitId, topic, on }) =>
      patchList<TopicWithUnits>(queryClient, topicsKey(userId, subjectId), (list) => {
        const link: UnitTopic = {
          user_id: userId!,
          unit_id: unitId,
          topic_id: topic.id,
          assigned_by: 'user',
        }
        const withTopic = list.some((t) => t.id === topic.id)
          ? list
          : [
              ...list,
              {
                id: topic.id,
                user_id: userId!,
                subject_id: subjectId!,
                name: topic.name,
                unit_topics: [],
              },
            ]
        return withTopic.map((t) =>
          t.id !== topic.id
            ? t
            : {
                ...t,
                unit_topics: on
                  ? [...t.unit_topics.filter((l) => l.unit_id !== unitId), link]
                  : t.unit_topics.filter((l) => l.unit_id !== unitId),
              },
        )
      }),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: topicsKey(userId, subjectId) }),
  })
}

// ---------------------------------------------------------------- cards

export function useCards(unitId: string | undefined) {
  const userId = useUserId()
  return useQuery({
    queryKey: cardsKey(userId, unitId),
    enabled: Boolean(userId && unitId),
    queryFn: async (): Promise<Card[]> => {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('unit_id', unitId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useSaveCard() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (form: CardForm) => {
      const { error } = await supabase
        .from('cards')
        .upsert({ id: form.id, unit_id: form.unitId, front: form.front, back: form.back })
      if (error) throw error
    },
    onMutate: (form) =>
      patchList<Card>(queryClient, cardsKey(userId, form.unitId), (list) => {
        const old = list.find((c) => c.id === form.id)
        const card: Card = {
          user_id: userId!,
          origin: 'user',
          created_at: now(),
          updated_at: now(),
          ...old,
          id: form.id,
          unit_id: form.unitId,
          front: form.front,
          back: form.back,
        }
        return old ? list.map((c) => (c.id === form.id ? card : c)) : [...list, card]
      }),
    onError: (_error, _form, rollback) => rollback?.(),
    onSettled: (_data, _error, form) =>
      queryClient.invalidateQueries({ queryKey: cardsKey(userId, form.unitId) }),
  })
}

export function useDeleteCard() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; unitId: string }) => {
      const { error } = await supabase.from('cards').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, unitId }) =>
      patchList<Card>(queryClient, cardsKey(userId, unitId), (list) =>
        list.filter((c) => c.id !== id),
      ),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: (_data, _error, { unitId }) =>
      queryClient.invalidateQueries({ queryKey: cardsKey(userId, unitId) }),
  })
}

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'
import { toAssessmentRow, toDeadlineRow, toSubjectRow } from './mappers'
import type { Assessment, Deadline, Subject, SubjectWithAssessments } from './model'
import type { AssessmentForm, DeadlineForm, SubjectForm } from './schemas'

// IDs come from the client (crypto.randomUUID()), so every write is an idempotent upsert.
// The offline queue (Stage 5) will wrap these same writes.

export const subjectsKey = (userId: string | undefined) => ['subjects', userId] as const
export const deadlinesKey = (userId: string | undefined) => ['deadlines', userId] as const

function useUserId() {
  return useAuth().session?.user.id
}

export function useSubjects() {
  const userId = useUserId()
  return useQuery({
    queryKey: subjectsKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<SubjectWithAssessments[]> => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*, assessments(*)')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useSubject(id: string | undefined) {
  const query = useSubjects()
  return { ...query, data: query.data?.find((s) => s.id === id) }
}

export function useDeadlines() {
  const userId = useUserId()
  return useQuery({
    queryKey: deadlinesKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Deadline[]> => {
      const { data, error } = await supabase.from('deadlines').select('*').order('due_at')
      if (error) throw error
      return data
    },
  })
}

/** Optimistically patch the cached subject list; returns a rollback for onError. */
async function patchSubjects(
  queryClient: QueryClient,
  userId: string | undefined,
  patch: (list: SubjectWithAssessments[]) => SubjectWithAssessments[],
) {
  const key = subjectsKey(userId)
  await queryClient.cancelQueries({ queryKey: key })
  const previous = queryClient.getQueryData<SubjectWithAssessments[]>(key)
  queryClient.setQueryData<SubjectWithAssessments[]>(key, (old) => patch(old ?? []))
  return () => queryClient.setQueryData(key, previous)
}

async function patchDeadlines(
  queryClient: QueryClient,
  userId: string | undefined,
  patch: (list: Deadline[]) => Deadline[],
) {
  const key = deadlinesKey(userId)
  await queryClient.cancelQueries({ queryKey: key })
  const previous = queryClient.getQueryData<Deadline[]>(key)
  queryClient.setQueryData<Deadline[]>(key, (old) => patch(old ?? []))
  return () => queryClient.setQueryData(key, previous)
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item]
}

const placeholderMeta = (userId: string) => {
  const now = new Date().toISOString()
  return { user_id: userId, created_at: now, updated_at: now }
}

function optimisticSubject(
  userId: string,
  form: SubjectForm,
  existing: Subject | undefined,
): SubjectWithAssessments {
  const row = toSubjectRow(form)
  const meta = placeholderMeta(userId)
  return {
    ...meta,
    archived: false,
    ...existing,
    id: form.id,
    name: row.name,
    color: row.color ?? null,
    priority: row.priority ?? 3,
    study_mode: row.study_mode ?? 'regular',
    campaign_start_on: row.campaign_start_on ?? null,
    assessments: form.assessments.map((a) => optimisticAssessment(userId, form.id, a)),
  }
}

function optimisticAssessment(userId: string, subjectId: string, form: AssessmentForm): Assessment {
  const row = toAssessmentRow(subjectId, form)
  return {
    ...placeholderMeta(userId),
    id: form.id,
    subject_id: subjectId,
    kind: form.kind,
    title: form.title,
    at: row.at,
    format: form.format,
    scope_all: form.scopeAll,
    contingent: form.contingent,
    date_tentative: form.dateTentative,
    passed: false,
    weight_pct: null,
    readiness_before: null,
    result_points: null,
    result_max: null,
  }
}

/** Create or edit a subject together with its exams; exams removed in the form are deleted. */
export function useSaveSubject() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (form: SubjectForm) => {
      const { error } = await supabase.from('subjects').upsert(toSubjectRow(form))
      if (error) throw error
      if (form.assessments.length > 0) {
        const rows = form.assessments.map((a) => toAssessmentRow(form.id, a))
        const { error: aError } = await supabase.from('assessments').upsert(rows)
        if (aError) throw aError
      }
      const keep = form.assessments.map((a) => a.id)
      let remove = supabase.from('assessments').delete().eq('subject_id', form.id)
      if (keep.length > 0) remove = remove.not('id', 'in', `(${keep.join(',')})`)
      const { error: dError } = await remove
      if (dError) throw dError
    },
    onMutate: (form) =>
      patchSubjects(queryClient, userId, (list) => {
        const existing = list.find((s) => s.id === form.id)
        return upsertById(list, optimisticSubject(userId!, form, existing))
      }),
    onError: (_error, _form, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
  })
}

export function useArchiveSubject() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from('subjects').update({ archived }).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, archived }) =>
      patchSubjects(queryClient, userId, (list) =>
        list.map((s) => (s.id === id ? { ...s, archived } : s)),
      ),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
  })
}

/** Partial update of subject fields that are edited outside the full form (priority, mode). */
export function useUpdateSubject() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<Subject, 'priority' | 'study_mode' | 'campaign_start_on'>>
    }) => {
      const { error } = await supabase.from('subjects').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, patch }) =>
      patchSubjects(queryClient, userId, (list) =>
        list.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      ),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
  })
}

export function useSaveAssessment() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ subjectId, form }: { subjectId: string; form: AssessmentForm }) => {
      const { error } = await supabase.from('assessments').upsert(toAssessmentRow(subjectId, form))
      if (error) throw error
    },
    onMutate: ({ subjectId, form }) =>
      patchSubjects(queryClient, userId, (list) =>
        list.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                assessments: upsertById(s.assessments, {
                  ...s.assessments.find((a) => a.id === form.id),
                  ...optimisticAssessment(userId!, subjectId, form),
                }),
              }
            : s,
        ),
      ),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
  })
}

export function useDeleteAssessment() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assessments').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) =>
      patchSubjects(queryClient, userId, (list) =>
        list.map((s) => ({ ...s, assessments: s.assessments.filter((a) => a.id !== id) })),
      ),
    onError: (_error, _id, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
  })
}

export function useSaveDeadline() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (form: DeadlineForm) => {
      const { error } = await supabase.from('deadlines').upsert(toDeadlineRow(form))
      if (error) throw error
    },
    onMutate: (form) =>
      patchDeadlines(queryClient, userId, (list) => {
        const existing = list.find((d) => d.id === form.id)
        const row = toDeadlineRow(form)
        const next: Deadline = {
          ...placeholderMeta(userId!),
          done: false,
          done_minutes: 0,
          ...existing,
          id: form.id,
          subject_id: form.subjectId,
          title: form.title,
          kind: form.kind,
          due_at: row.due_at,
          est_minutes: row.est_minutes ?? null,
          notes: row.notes ?? null,
        }
        return upsertById(list, next).sort((a, b) => a.due_at.localeCompare(b.due_at))
      }),
    onError: (_error, _form, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: deadlinesKey(userId) }),
  })
}

export function useSetDeadlineDone() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from('deadlines').update({ done }).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, done }) =>
      patchDeadlines(queryClient, userId, (list) =>
        list.map((d) => (d.id === id ? { ...d, done } : d)),
      ),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: deadlinesKey(userId) }),
  })
}

export function useDeleteDeadline() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deadlines').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) =>
      patchDeadlines(queryClient, userId, (list) => list.filter((d) => d.id !== id)),
    onError: (_error, _id, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: deadlinesKey(userId) }),
  })
}

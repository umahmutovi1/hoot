import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'
import { toAssessmentRow, toDeadlineRow, toSubjectRow } from './mappers'
import type { Assessment, Deadline, Subject, SubjectWithAssessments } from './model'
import type { AssessmentForm, DeadlineForm, SubjectForm } from './schemas'

// IDs come from the client (crypto.randomUUID()), so every write is an idempotent upsert.
// The offline queue (Stage 6) will wrap these same writes.

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
        // Archived exams are out of every screen, the plan and grades (decision after 10b).
        .is('assessments.archived_at', null)
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

const archivedExamsKey = (userId: string | undefined, subjectId: string) =>
  ['subjects', userId, subjectId, 'archived-exams'] as const

/** "Arhivirani ispiti" on a subject, to restore. */
export function useArchivedExams(subjectId: string) {
  const userId = useUserId()
  return useQuery({
    queryKey: archivedExamsKey(userId, subjectId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select('id, title, at')
        .eq('subject_id', subjectId)
        .not('archived_at', 'is', null)
        .order('at')
      if (error) throw error
      return data
    },
  })
}

/** Archive (or restore) an exam: out of Danas, the calendar, the plan and grades (after 10b). */
export function useArchiveExam(subjectId: string) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('assessments')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, archived }) =>
      archived
        ? patchSubjects(queryClient, userId, (list) =>
            list.map((s) => ({ ...s, assessments: s.assessments.filter((a) => a.id !== id) })),
          )
        : undefined,
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: subjectsKey(userId) })
      void queryClient.invalidateQueries({ queryKey: archivedExamsKey(userId, subjectId) })
    },
  })
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
  existing: SubjectWithAssessments | undefined,
): SubjectWithAssessments {
  const row = toSubjectRow(form)
  const meta = placeholderMeta(userId)
  return {
    ...meta,
    archived: false,
    points_total: 100,
    grade_scale: null,
    custom_scale: false,
    target_grade: null,
    priority_boost_until: null,
    ...existing,
    id: form.id,
    name: row.name,
    color: row.color ?? null,
    priority: row.priority ?? 3,
    study_mode: row.study_mode ?? 'regular',
    campaign_start_on: row.campaign_start_on ?? null,
    academic_year_id:
      row.academic_year_id !== undefined
        ? row.academic_year_id
        : (existing?.academic_year_id ?? null),
    semester_no: row.semester_no !== undefined ? row.semester_no : (existing?.semester_no ?? null),
    assessments: form.assessments.map((a) =>
      optimisticAssessment(
        userId,
        form.id,
        a,
        existing?.assessments.find((e) => e.id === a.id),
      ),
    ),
  }
}

/** Form fields over the cached row, so results entered elsewhere stay. */
function optimisticAssessment(
  userId: string,
  subjectId: string,
  form: AssessmentForm,
  existing?: Assessment,
): Assessment {
  const row = toAssessmentRow(subjectId, form)
  return {
    ...placeholderMeta(userId),
    passed: false,
    readiness_before: null,
    result_points: null,
    result_max: null,
    result_annulled: false,
    archived_at: null,
    ...existing,
    id: form.id,
    subject_id: subjectId,
    kind: form.kind,
    title: form.title,
    at: row.at,
    format: form.format,
    scope_all: form.scopeAll,
    contingent: form.contingent,
    date_tentative: form.dateTentative,
    at_latest: row.at_latest ?? null,
    exam_period_id: row.exam_period_id ?? null,
    points_max: row.points_max ?? null,
    points_unit: row.points_unit ?? 'points',
    pass_min_pct: row.pass_min_pct ?? null,
    entry_min_points: row.entry_min_points ?? null,
    retake_of: row.retake_of ?? null,
    eve_reserved:
      row.eve_reserved !== undefined ? row.eve_reserved : (existing?.eve_reserved ?? null),
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

/** Partial update of subject fields edited outside the full form (priority, mode, scale). */
export function useUpdateSubject() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<
        Pick<
          Subject,
          | 'priority'
          | 'study_mode'
          | 'campaign_start_on'
          | 'points_total'
          | 'grade_scale'
          | 'custom_scale'
          | 'target_grade'
        >
      >
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
                assessments: upsertById(
                  s.assessments,
                  optimisticAssessment(
                    userId!,
                    subjectId,
                    form,
                    s.assessments.find((a) => a.id === form.id),
                  ),
                ),
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
          result_points: null,
          result_max: null,
          ...existing,
          id: form.id,
          subject_id: form.subjectId,
          title: form.title,
          kind: form.kind,
          due_at: row.due_at,
          est_minutes: row.est_minutes ?? null,
          notes: row.notes ?? null,
          points_max: row.points_max ?? null,
          points_unit: row.points_unit ?? 'points',
          pass_min_pct: row.pass_min_pct ?? null,
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

export type ExamResultPatch = Partial<
  Pick<Assessment, 'result_points' | 'result_max' | 'passed' | 'result_annulled'>
>

/** "Rezultat": points, maximum, passed and waiver of one exam. */
export function useSaveExamResult() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ExamResultPatch }) => {
      const { error } = await supabase.from('assessments').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, patch }) =>
      patchSubjects(queryClient, userId, (list) =>
        list.map((s) => ({
          ...s,
          assessments: s.assessments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      ),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
  })
}

/** "Dan pred ispit": true = reserved, false = declined (no card again), null = not asked. */
export function useSetEveReserved() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean | null }) => {
      const { error } = await supabase
        .from('assessments')
        .update({ eve_reserved: value })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, value }) =>
      patchSubjects(queryClient, userId, (list) =>
        list.map((s) => ({
          ...s,
          assessments: s.assessments.map((a) => (a.id === id ? { ...a, eve_reserved: value } : a)),
        })),
      ),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: subjectsKey(userId) }),
  })
}

export type DeadlineResultPatch = Partial<Pick<Deadline, 'result_points' | 'result_max' | 'done'>>

/** Result of a homework or seminar paper; entering one also marks the deadline done. */
export function useSaveDeadlineResult() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: DeadlineResultPatch }) => {
      const { error } = await supabase.from('deadlines').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, patch }) =>
      patchDeadlines(queryClient, userId, (list) =>
        list.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      ),
    onError: (_error, _vars, rollback) => rollback?.(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: deadlinesKey(userId) }),
  })
}

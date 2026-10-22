import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { syncQueueFor } from '@/app/sync'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'
import type { Op, Row, SyncQueue } from '@/lib/sync'
import type { StudyMode } from '@/lib/estimates/calibration'
import { closeAt, openSegment } from '@/lib/session/timer'
import type { Tables } from '@/types/database'
import { toSegment, type ActiveSession, type SegmentRow, type SessionRow } from './model'

// The timer lives in the offline queue (src/lib/sync): every action is written to IndexedDB
// first and mirrored locally, then sent to Supabase. Reads merge the server with the mirror, so a
// locked phone, a closed tab or no network never lose a segment. Queries run with
// networkMode 'always' because offline they still have the mirror to read.

const SESSION_COLUMNS =
  'id, subject_id, block_id, mode, timer_mode, origin, planned_minutes, started_at, ended_at, focus, focus_reasons, distractions, break_ends_at, reflection, updated_at'
const SEGMENT_COLUMNS = 'id, session_id, unit_id, started_at, ended_at'

export const activeSessionKey = (userId: string | undefined) =>
  ['session', 'active', userId] as const
export const sessionKey = (userId: string | undefined, id: string | undefined) =>
  ['session', 'one', userId, id] as const
export const modeRatesKey = (userId: string | undefined, subjectId: string | undefined) =>
  ['session', 'modeRates', userId, subjectId] as const

function useUserId() {
  return useAuth().session?.user.id
}

/** Server rows merged with the mirror; the mirror alone when the server cannot be reached. */
async function read<T>(
  queue: SyncQueue,
  table: string,
  match: Record<string, unknown>,
  fetch: () => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const { data, error } = await fetch()
  if (error || !data) return (await queue.local(table, match)).map((r) => r.row as T)
  await queue.remember(table, data as Row[])
  return (await queue.merge(table, data as Row[], match)) as T[]
}

async function loadSegments(queue: SyncQueue, sessionId: string): Promise<SegmentRow[]> {
  return read<SegmentRow>(queue, 'study_segments', { session_id: sessionId }, () =>
    supabase.from('study_segments').select(SEGMENT_COLUMNS).eq('session_id', sessionId),
  )
}

export function useActiveSession() {
  const userId = useUserId()
  return useQuery({
    queryKey: activeSessionKey(userId),
    enabled: Boolean(userId),
    networkMode: 'always',
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ActiveSession | null> => {
      const queue = syncQueueFor(userId!)
      const sessions = await read<SessionRow>(queue, 'study_sessions', { ended_at: null }, () =>
        supabase.from('study_sessions').select(SESSION_COLUMNS).is('ended_at', null),
      )
      const session = sessions.sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
      if (!session) return null
      return { session, segments: await loadSegments(queue, session.id) }
    },
  })
}

/** One session with its segments (the end screen reads an ended one). */
export function useSession(id: string | undefined) {
  const userId = useUserId()
  return useQuery({
    queryKey: sessionKey(userId, id),
    enabled: Boolean(userId && id),
    networkMode: 'always',
    queryFn: async (): Promise<ActiveSession | null> => {
      const queue = syncQueueFor(userId!)
      const [session] = await read<SessionRow>(queue, 'study_sessions', { id }, () =>
        supabase.from('study_sessions').select(SESSION_COLUMNS).eq('id', id!),
      )
      if (!session) return null
      return { session, segments: await loadSegments(queue, session.id) }
    },
  })
}

export type SessionListItem = SessionRow & { study_segments: SegmentRow[] }

/** Finished sessions, newest first (the history); unsent local sessions are included. */
export function useSessions() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['session', 'list', userId] as const,
    enabled: Boolean(userId),
    networkMode: 'always',
    queryFn: async (): Promise<SessionListItem[]> => {
      const queue = syncQueueFor(userId!)
      const { data, error } = await supabase
        .from('study_sessions')
        .select(`${SESSION_COLUMNS}, study_segments(${SEGMENT_COLUMNS})`)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(500)
      const remote = (error ? [] : data) as unknown as SessionListItem[]
      const merged = (error
        ? (await queue.local('study_sessions')).map((r) => r.row)
        : await queue.merge(
            'study_sessions',
            remote as unknown as Row[],
          )) as unknown as SessionListItem[]
      const out: SessionListItem[] = []
      for (const s of merged) {
        if (!s.ended_at) continue
        const local = (await queue.local('study_segments', { session_id: s.id })).map(
          (r) => r.row as unknown as SegmentRow,
        )
        const remoteSegs = remote.find((r) => r.id === s.id)?.study_segments ?? []
        const segs = new Map([...remoteSegs, ...local].map((x) => [x.id, x]))
        out.push({ ...s, study_segments: [...segs.values()] })
      }
      return out.sort((a, b) => b.started_at.localeCompare(a.started_at))
    },
  })
}

export type SessionUnitRow = Omit<Tables<'session_units'>, 'user_id'>

/** Saved minutes, amount and ratings of one session (editing it from the history). */
export function useSessionUnits(sessionId: string | undefined) {
  const userId = useUserId()
  return useQuery({
    queryKey: ['session', 'units', userId, sessionId] as const,
    enabled: Boolean(userId && sessionId),
    queryFn: async (): Promise<SessionUnitRow[]> => {
      const { data, error } = await supabase
        .from('session_units')
        .select('session_id, unit_id, minutes, amount_done, level_before, level_after, difficulty')
        .eq('session_id', sessionId!)
      if (error) throw error
      return data
    },
  })
}

export type ModeRate = Pick<
  Tables<'source_mode_rates'>,
  'source_id' | 'mode' | 'min_per_unit' | 'samples'
>

/** Calibration per source × mode of a subject's sources; null offline without a cached copy. */
export function useModeRates(subjectId: string | undefined, sourceIds: string[]) {
  const userId = useUserId()
  return useQuery({
    queryKey: [...modeRatesKey(userId, subjectId), sourceIds.join(',')],
    enabled: Boolean(userId && subjectId) && sourceIds.length > 0,
    queryFn: async (): Promise<ModeRate[]> => {
      const { data, error } = await supabase
        .from('source_mode_rates')
        .select('source_id, mode, min_per_unit, samples')
        .in('source_id', sourceIds)
      if (error) throw error
      return data
    },
  })
}

export interface StartInput {
  subjectId: string
  unitId: string | null
  mode: StudyMode | null
  /** Preset id (`study_sessions.timer_mode`). */
  timerMode: string
}

/** Writes through the offline queue: mirror first, then send when there is a network. */
export function useSessionWriter() {
  const userId = useUserId()
  const queryClient = useQueryClient()

  const write = useCallback(
    async (ops: Op[], optimistic?: (prev: ActiveSession | null) => ActiveSession | null) => {
      if (!userId) return
      if (optimistic)
        queryClient.setQueryData<ActiveSession | null>(activeSessionKey(userId), (prev) =>
          optimistic(prev ?? null),
        )
      const queue = syncQueueFor(userId)
      await queue.enqueue(...ops)
      if (navigator.onLine) void queue.flush()
    },
    [userId, queryClient],
  )

  return useMemo(() => {
    const nowIso = () => new Date().toISOString()
    const segmentOp = (rows: SegmentRow[]): Op => ({
      kind: 'upsert',
      table: 'study_segments',
      rows: rows as unknown as Row[],
    })
    const sessionOp = (row: SessionRow): Op => ({
      kind: 'upsert',
      table: 'study_sessions',
      rows: [row as unknown as Row],
    })

    return {
      write,

      start: async ({ subjectId, unitId, mode, timerMode }: StartInput) => {
        const t = nowIso()
        const session: SessionRow = {
          id: crypto.randomUUID(),
          subject_id: subjectId,
          block_id: null,
          mode,
          timer_mode: timerMode,
          origin: 'timer',
          planned_minutes: null,
          started_at: t,
          ended_at: null,
          focus: null,
          focus_reasons: null,
          distractions: 0,
          break_ends_at: null,
          reflection: null,
          updated_at: t,
        }
        const segment: SegmentRow = {
          id: crypto.randomUUID(),
          session_id: session.id,
          unit_id: unitId,
          started_at: t,
          ended_at: null,
        }
        await write([sessionOp(session), segmentOp([segment])], () => ({
          session,
          segments: [segment],
        }))
        return session.id
      },

      /** Closes the running segment; `breakEndsAt` is when the preset's break ends (Web Push, Stage 9). */
      pause: async ({ session, segments }: ActiveSession, breakEndsAt: Date | null = null) => {
        const open = segments.find((s) => s.ended_at === null)
        if (!open) return
        const t = nowIso()
        const closed = { ...open, ended_at: t }
        const row = { ...session, break_ends_at: breakEndsAt?.toISOString() ?? null, updated_at: t }
        await write([segmentOp([closed]), sessionOp(row)], () => ({
          session: row,
          segments: segments.map((s) => (s.id === open.id ? closed : s)),
        }))
      },

      resume: async ({ session, segments }: ActiveSession, unitId: string | null) => {
        if (openSegment(segments.map(toSegment))) return
        const t = nowIso()
        const segment: SegmentRow = {
          id: crypto.randomUUID(),
          session_id: session.id,
          unit_id: unitId,
          started_at: t,
          ended_at: null,
        }
        const ops = [segmentOp([segment])]
        const row = session.break_ends_at
          ? { ...session, break_ends_at: null, updated_at: t }
          : session
        if (row !== session) ops.push(sessionOp(row))
        await write(ops, () => ({ session: row, segments: [...segments, segment] }))
      },

      /** "Ometena sam": one more distraction in this session. */
      distracted: async ({ session, segments }: ActiveSession) => {
        const row = { ...session, distractions: session.distractions + 1, updated_at: nowIso() }
        await write([sessionOp(row)], () => ({ session: row, segments }))
      },

      /** "Sad radim na X": the running segment closes and a new one starts at the same instant. */
      switchUnit: async ({ session, segments }: ActiveSession, unitId: string | null) => {
        const open = segments.find((s) => s.ended_at === null)
        if (!open || open.unit_id === unitId) return
        const t = nowIso()
        const closed = { ...open, ended_at: t }
        const next: SegmentRow = {
          id: crypto.randomUUID(),
          session_id: session.id,
          unit_id: unitId,
          started_at: t,
          ended_at: null,
        }
        await write([segmentOp([closed, next])], () => ({
          session,
          segments: [...segments.map((s) => (s.id === open.id ? closed : s)), next],
        }))
      },

      update: async (
        { session, segments }: ActiveSession,
        patch: Partial<Pick<SessionRow, 'mode' | 'timer_mode'>>,
      ) => {
        const row = { ...session, ...patch, updated_at: nowIso() }
        await write([sessionOp(row)], () => ({ session: row, segments }))
      },

      /** Ends the session at `at` (now, or the corrected end of a forgotten timer). */
      finish: async ({ session, segments }: ActiveSession, at: Date = new Date()) => {
        const { keep, drop } = closeAt(segments.map(toSegment), at)
        const end = at.toISOString()
        const kept = segments
          .filter((s) => !drop.includes(s.id))
          .map((s) => {
            const k = keep.find((x) => x.id === s.id)!
            return { ...s, ended_at: k.endedAt!.toISOString() }
          })
        const ops: Op[] = [
          ...(kept.length > 0 ? [segmentOp(kept)] : []),
          ...drop.map((id): Op => ({ kind: 'delete', table: 'study_segments', match: { id } })),
          sessionOp({ ...session, ended_at: end, updated_at: nowIso() }),
        ]
        await write(ops, () => null)
        queryClient.setQueryData(sessionKey(userId, session.id), {
          session: { ...session, ended_at: end },
          segments: kept,
        })
      },

      /** Saved segments edited in the history; the session spans its first to last segment. */
      saveSegments: async (
        session: SessionRow,
        segments: SegmentRow[],
        removed: string[],
        units: Row[],
      ) => {
        const sorted = [...segments].sort((a, b) => a.started_at.localeCompare(b.started_at))
        const end = sorted.reduce(
          (m, x) => (x.ended_at! > m ? x.ended_at! : m),
          sorted[0]!.ended_at!,
        )
        const row = {
          ...session,
          started_at: sorted[0]!.started_at,
          ended_at: end,
          updated_at: nowIso(),
        }
        await write([
          sessionOp(row),
          ...removed.map((id): Op => ({ kind: 'delete', table: 'study_segments', match: { id } })),
          segmentOp(sorted),
          ...(units.length > 0
            ? [
                {
                  kind: 'upsert',
                  table: 'session_units',
                  onConflict: 'session_id,unit_id',
                  rows: units,
                } as Op,
              ]
            : []),
        ])
        queryClient.setQueryData(sessionKey(userId, session.id), { session: row, segments: sorted })
      },

      /** A session studied without the timer: one segment, never used for speed calibration. */
      addManual: async (input: {
        subjectId: string
        mode: StudyMode | null
        start: Date
        end: Date
      }) => {
        const session: SessionRow = {
          id: crypto.randomUUID(),
          subject_id: input.subjectId,
          block_id: null,
          mode: input.mode,
          timer_mode: 'free',
          origin: 'manual',
          planned_minutes: null,
          started_at: input.start.toISOString(),
          ended_at: input.end.toISOString(),
          focus: null,
          focus_reasons: null,
          distractions: 0,
          break_ends_at: null,
          reflection: null,
          updated_at: nowIso(),
        }
        const segment: SegmentRow = {
          id: crypto.randomUUID(),
          session_id: session.id,
          unit_id: null,
          started_at: session.started_at,
          ended_at: session.ended_at,
        }
        await write([sessionOp(session), segmentOp([segment])])
        queryClient.setQueryData(sessionKey(userId, session.id), { session, segments: [segment] })
        return session.id
      },

      /** Deletes a saved session with its segments and units (cascade). */
      remove: async (session: SessionRow) => {
        await write([{ kind: 'delete', table: 'study_sessions', match: { id: session.id } }])
      },

      /** "Odbaci": the session is deleted and nothing is calibrated. */
      discard: async ({ session }: ActiveSession) => {
        await write(
          [{ kind: 'delete', table: 'study_sessions', match: { id: session.id } }],
          () => null,
        )
      },
    }
  }, [write, queryClient, userId])
}

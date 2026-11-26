import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { TutorRequest, TutorResponse } from '@shared/schemas.ts'
import { invokeAi } from '@/features/owl/api'
import { useActiveSession, useSessionWriter } from '@/features/session/api'
import { usePresets } from '@/features/session/presets'
import { useLocale } from '@/features/settings/useLocale'

// The AI tutor (PRD "AI tutor", Sprint 18): calls to the `tutor` function and the session the
// tutor's time belongs to.

type Body<K extends TutorRequest['op']> = Omit<Extract<TutorRequest, { op: K }>, 'op' | 'locale'>
type Answer<K extends TutorRequest['op']> = Extract<TutorResponse, { op: K }>

function useTutorCall<K extends TutorRequest['op']>(op: K) {
  const { locale } = useLocale()
  return useMutation({
    // Screens show the error inline; nothing here is a plan input.
    meta: { silent: true, planInput: false },
    mutationFn: (body: Body<K>) =>
      invokeAi<Answer<K>>('tutor', { ...body, op, locale } as unknown as TutorRequest),
  })
}

export const useExplain = () => useTutorCall('explain')
export const useGrade = () => useTutorCall('grade')
export const useFeynman = () => useTutorCall('feynman')
export const useTextQuestions = () => useTutorCall('questions')

/**
 * Time with the tutor is session time (PRD: "Vrijeme sa tutorom je vrijeme sesije"). On a tutor
 * screen the running segment becomes a `tutor` segment on this unit; without an active session
 * one starts (and `startedHere` says the tutor owns it, so "Gotovo" ends it). Leaving the tutor
 * switches back to study time; the timer never stops.
 */
export function useTutorTime(subjectId: string | undefined, unitId: string | undefined) {
  const { data: active, isPending } = useActiveSession()
  const writer = useSessionWriter()
  const { suggestedId } = usePresets()
  const startedHere = useRef(false)
  const [ownSession, setOwnSession] = useState(false)
  const starting = useRef(false)
  const activeRef = useRef(active)
  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (isPending || !subjectId || !unitId || starting.current) return
    if (!active) {
      starting.current = true
      startedHere.current = true
      void writer
        .start({
          subjectId,
          unitId,
          mode: null,
          timerMode: suggestedId,
          kind: 'tutor',
        })
        .then(() => setOwnSession(true))
        .finally(() => {
          starting.current = false
        })
      return
    }
    // Another subject's session keeps running as it is (one active session per user).
    if (active.session.subject_id !== subjectId) return
    // A paused session resumes: time with the tutor is study time.
    if (active.segments.every((x) => x.ended_at !== null))
      void writer.resume(active, unitId, 'tutor')
    else void writer.switchKind(active, 'tutor', unitId)
  }, [isPending, active, subjectId, unitId, writer, suggestedId])

  // Back to study time when the tutor closes (the session the tutor started is ended by "Gotovo").
  useEffect(
    () => () => {
      const a = activeRef.current
      if (a && !startedHere.current) void writer.switchKind(a, 'study', unitId ?? null)
    },
    [writer, unitId],
  )

  const finish = useCallback(async () => {
    const a = activeRef.current
    if (a && startedHere.current) await writer.finish(a)
  }, [writer])

  return { active, startedHere: ownSession, finish }
}

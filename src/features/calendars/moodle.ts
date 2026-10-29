import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { deadlinesKey, useDeadlines, useSubjects } from '@/features/subjects/api'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { proposeDeadlines, type DeadlineProposal } from '@/lib/import'
import { supabase } from '@/lib/supabase'
import { eventsKey, useCalendarFeeds, useExternalEvents } from './api'

// Deadlines from connected "Rokovi" calendars (Moodle, PRD "Povezani kalendari"): the events are
// offered as deadlines on Danas and written only after the review ("Primijeni").

/** New or moved deadlines from deadline feeds and deadline events; [] until everything is loaded. */
export function useDeadlineProposals(): DeadlineProposal[] {
  const { data: feeds } = useCalendarFeeds()
  const { data: events } = useExternalEvents()
  const { data: deadlines } = useDeadlines()
  const { data: subjects } = useSubjects()
  const kindOf = useScheduleData().eventKinds.kindOf
  // The moment the screen opened: what is "upcoming" does not move while it is open.
  const [now] = useState(() => new Date())
  return useMemo(() => {
    if (!feeds || !events || !deadlines || !subjects) return []
    // Moodle feeds, and deadlines found in any calendar (classification, Stage 10d).
    const feedIds = new Set(feeds.filter((f) => f.kind === 'deadlines').map((f) => f.id))
    return proposeDeadlines(
      events
        .filter((e) => feedIds.has(e.feed_id) || kindOf.get(e.id) === 'deadline')
        .map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          startsAt: e.starts_at,
          deadlineId: e.deadline_id,
          ignored: e.ignored,
        })),
      subjects.filter((s) => !s.archived),
      deadlines.map((d) => ({ id: d.id, dueAt: d.due_at })),
      now,
    )
  }, [feeds, events, deadlines, subjects, now, kindOf])
}

/** "Primijeni N": new deadlines are created and linked, moved ones get the new date, skipped ones are ignored. */
export function useApplyDeadlines() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (proposals: DeadlineProposal[]) => {
      for (const p of proposals) {
        if (!p.include) {
          const { error } = await supabase
            .from('external_events')
            .update({ ignored: true })
            .eq('id', p.eventId)
          if (error) throw error
          continue
        }
        if (p.deadlineId) {
          const { error } = await supabase
            .from('deadlines')
            .update({ due_at: p.dueAt })
            .eq('id', p.deadlineId)
          if (error) throw error
          continue
        }
        const id = crypto.randomUUID()
        const { error } = await supabase.from('deadlines').insert({
          id,
          subject_id: p.subjectId,
          kind: 'assignment',
          title: p.title.slice(0, 200),
          due_at: p.dueAt,
        })
        if (error) throw error
        const { error: linkError } = await supabase
          .from('external_events')
          .update({ deadline_id: id })
          .eq('id', p.eventId)
        if (linkError) throw linkError
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: deadlinesKey(userId) }),
        queryClient.invalidateQueries({ queryKey: eventsKey(userId) }),
      ]),
  })
}

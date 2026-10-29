import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { scheduleKey, usePeriods, useTimetable } from '@/features/schedule/api'
import { toPeriod } from '@/features/schedule/model'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useDayBoundary } from '@/features/settings/profile'
import { subjectsKey, useSubjects } from '@/features/subjects/api'
import { examKindDefaults, type AssessmentKind } from '@/features/subjects/model'
import { fold } from '@/lib/calendar/classify'
import {
  calendarProposals,
  type ExamProposal,
  type LectureProposal,
  type MatchEvent,
  type MatchRow,
} from '@/lib/calendar/match'
import { localDay } from '@/lib/day'
import { currentTeachingPeriod } from '@/lib/schedule'
import { supabase } from '@/lib/supabase'
import {
  eventsKey,
  matchesKey,
  useCalendarFeeds,
  useCalendarMatches,
  useExternalEvents,
} from './api'
import { googleCall } from './google'

// Lectures and exams from connected calendars vs Hoot (docs/CALENDAR-SYNC.md "Duplikati"): the
// proposals, the user's decisions in calendar_matches, and applying them.

/** Events of all feeds with their kind and series, as `src/lib/calendar/match` reads them. */
export function useMatchEvents(): MatchEvent[] {
  const { data: rows } = useExternalEvents()
  const { eventKinds } = useScheduleData()
  return useMemo(
    () =>
      (rows ?? [])
        .filter((r) => !r.ignored && !r.all_day)
        .map((r) => ({
          id: r.id,
          feedId: r.feed_id,
          uid: r.uid,
          title: r.title,
          startsAt: new Date(r.starts_at),
          endsAt: new Date(r.ends_at),
          kind: eventKinds.kindOf.get(r.id) ?? 'busy',
          inSeries: eventKinds.series.has(r.id),
        })),
    [rows, eventKinds],
  )
}

export function useCalendarProposals() {
  const events = useMatchEvents()
  const { data: matches } = useCalendarMatches()
  const { data: subjects } = useSubjects()
  const { data: timetable } = useTimetable()
  const { timeZone } = useScheduleData()
  // The moment the screen opened: what is upcoming does not move while it is open.
  const [now] = useState(() => new Date())
  return useMemo(() => {
    if (!matches || !subjects || !timetable) return { lectures: [], exams: [] }
    const active = subjects.filter((s) => !s.archived)
    return calendarProposals({
      events,
      matches,
      entries: timetable.map((e) => ({
        id: e.id,
        subjectId: e.subject_id,
        weekday: e.weekday,
        startMin: e.start_min,
        endMin: e.end_min,
      })),
      exams: active.flatMap((s) =>
        s.assessments
          .filter((a) => !a.archived_at)
          .map((a) => ({ id: a.id, subjectId: s.id, at: a.at })),
      ),
      subjects: active.map((s) => ({ id: s.id, name: s.name })),
      timeZone,
      now,
    })
  }, [events, matches, subjects, timetable, timeZone, now])
}

/** What the user picked for a row. */
export type MatchAction =
  | 'add' // new: put it into Hoot, linked
  | 'link' // same: one thing (Spoji)
  | 'google' // same: Hoot takes the calendar's time (Google zamjenjuje)
  | 'hoot' // same: the calendar's event is deleted, Hoot's stays (Hoot zamjenjuje)
  | 'distinct' // same: two different things (Zadrži oba)
  | 'skip' // new: not in Hoot
  | 'accept' // changed: the exam takes the calendar's new date
  | 'keep' // changed: Hoot's date stays

export function actionsFor(status: 'new' | 'same' | 'changed', google: boolean): MatchAction[] {
  if (status === 'new') return ['add', 'skip']
  if (status === 'changed') return ['accept', 'keep']
  return google ? ['link', 'google', 'hoot', 'distinct'] : ['link', 'google', 'distinct']
}

export class NoTeachingPeriod extends Error {}

function examKindOf(title: string): AssessmentKind {
  const t = fold(title)
  if (/\b(parcijal|kolokvij|midterm)/.test(t)) return 'partial'
  if (/\bintegral/.test(t)) return 'integral'
  if (/\b(popravn|makeup|retake)/.test(t)) return 'makeup'
  if (/\b(zavrsn|final)/.test(t)) return 'final'
  return 'other'
}

export interface LectureChoice {
  proposal: LectureProposal
  action: MatchAction
  subjectId: string | null
}

export interface ExamChoice {
  proposal: ExamProposal
  action: MatchAction
  subjectId: string | null
}

export function useApplyCalendarProposals() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  const boundary = useDayBoundary()
  const periodRows = usePeriods().data ?? []
  const feeds = useCalendarFeeds().data ?? []

  return useMutation({
    mutationFn: async ({ lectures, exams }: { lectures: LectureChoice[]; exams: ExamChoice[] }) => {
      const rows: MatchRow[] = []
      const decide = (
        p: LectureProposal | ExamProposal,
        kind: 'lecture' | 'exam',
        decision: 'linked' | 'distinct' | 'skipped' | 'hoot',
        targetId: string | null,
        seenStart: string | null,
      ) =>
        rows.push({
          feed_id: p.feedId,
          match_key: p.matchKey,
          kind,
          target_id: targetId,
          decision,
          seen_start: seenStart,
        })
      const toDelete: string[] = []

      const teaching = currentTeachingPeriod(
        localDay(new Date(), boundary),
        periodRows.map(toPeriod),
      )
      for (const { proposal: p, action, subjectId } of lectures) {
        if (action === 'add') {
          if (!teaching) throw new NoTeachingPeriod()
          const id = crypto.randomUUID()
          const { error } = await supabase.from('timetable_entries').insert({
            id,
            subject_id: subjectId,
            kind: p.classKind,
            weekday: p.weekday,
            start_min: p.startMin,
            end_min: p.endMin,
            location: null,
            week_parity: null,
            period_id: teaching.id,
            valid_from: teaching.startsOn,
            valid_to: teaching.endsOn,
          })
          if (error) throw error
          decide(p, 'lecture', 'linked', id, null)
        } else if (action === 'google' && p.existingId) {
          const { error } = await supabase
            .from('timetable_entries')
            .update({ start_min: p.startMin, end_min: p.endMin })
            .eq('id', p.existingId)
          if (error) throw error
          decide(p, 'lecture', 'linked', p.existingId, null)
        } else if (action === 'link') decide(p, 'lecture', 'linked', p.existingId, null)
        else if (action === 'hoot') {
          toDelete.push(...p.eventIds)
          decide(p, 'lecture', 'hoot', p.existingId, null)
        } else if (action === 'distinct') decide(p, 'lecture', 'distinct', p.existingId, null)
        else if (action === 'skip') decide(p, 'lecture', 'skipped', null, null)
      }

      for (const { proposal: p, action, subjectId } of exams) {
        if (action === 'add') {
          if (!subjectId) continue
          const id = crypto.randomUUID()
          const kind = examKindOf(p.title)
          const defaults = examKindDefaults(kind)
          const { error } = await supabase.from('assessments').insert({
            id,
            subject_id: subjectId,
            kind,
            title: p.title.slice(0, 120),
            at: p.startsAt,
            scope_all: defaults.scopeAll,
            contingent: defaults.contingent,
          })
          if (error) throw error
          decide(p, 'exam', 'linked', id, p.startsAt)
        } else if ((action === 'google' || action === 'accept') && p.existingId) {
          // A tentative date becomes exact, as when an exam schedule is imported.
          const { error } = await supabase
            .from('assessments')
            .update({
              at: p.startsAt,
              date_tentative: false,
              at_latest: null,
              exam_period_id: null,
            })
            .eq('id', p.existingId)
          if (error) throw error
          decide(p, 'exam', 'linked', p.existingId, p.startsAt)
        } else if (action === 'link' || action === 'keep')
          decide(p, 'exam', 'linked', p.existingId, p.startsAt)
        else if (action === 'hoot') {
          toDelete.push(p.eventId)
          decide(p, 'exam', 'hoot', p.existingId, p.startsAt)
        } else if (action === 'distinct') decide(p, 'exam', 'distinct', p.existingId, p.startsAt)
        else if (action === 'skip') decide(p, 'exam', 'skipped', null, p.startsAt)
      }

      if (toDelete.length > 0) {
        // Only Google calendars can be changed; iCal links are read-only.
        if (feeds.some((f) => f.source === 'google'))
          await googleCall({ op: 'delete_events', event_ids: toDelete.slice(0, 200) })
      }
      if (rows.length > 0) {
        const { error } = await supabase
          .from('calendar_matches')
          .upsert(rows, { onConflict: 'feed_id,match_key' })
        if (error) throw error
      }
      return rows.length
    },
    onSettled: () =>
      Promise.all(
        [
          matchesKey(userId),
          subjectsKey(userId),
          scheduleKey('timetable_entries', userId),
          eventsKey(userId),
          ['plan', userId],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  })
}

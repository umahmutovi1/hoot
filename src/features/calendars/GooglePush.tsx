import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/auth-context'
import { useAgenda } from '@/features/plan/agenda'
import { useDayBlocks } from '@/features/plan/useDayBlocks'
import { useDayBoundary } from '@/features/settings/profile'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { localDateOf, shownExams } from '@/features/subjects/model'
import {
  calendarItems,
  diffItems,
  PUSH_HORIZON_DAYS,
  type BlockInput,
  type ClassInput,
} from '@/lib/calendar/items'
import { addDays, dayStartInstant, localDay, zonedInstant } from '@/lib/day'
import { supabase } from '@/lib/supabase'
import { useCalendarFeeds, useCalendarMatches } from './api'
import { calendarItemsKey, googleCall, useGoogleAccount, useStoredItems } from './google'
import { inGoogleAlready } from '@/lib/calendar/match'

/** Serial edits (a replan writes many blocks) settle before Google gets them. */
const DEBOUNCE_MS = 2000

/**
 * Hoot → Google (docs/CALENDAR-SYNC.md): the app computes the plan, so it also computes what goes
 * into the "Hoot" Google calendar (blocks and classes for 14 days, every exam and deadline),
 * writes the changed `calendar_items` and asks `google-calendar` to push. Google shows it within
 * seconds; pg_cron retries what an offline app could not send.
 */
export function GooglePush() {
  const userId = useAuth().session?.user.id
  const { data: account } = useGoogleAccount()
  const connected = Boolean(userId && account && account.status === 'active')
  // Mounted only with a connected account: the plan hooks stay idle otherwise.
  return connected ? <Pusher /> : null
}

function Pusher() {
  const { t } = useTranslation()
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  const boundary = useDayBoundary()
  const dayBlocks = useDayBlocks()
  const agenda = useAgenda()
  const { data: subjects } = useSubjects()
  const { data: deadlines } = useDeadlines()
  const stored = useStoredItems(true)
  const { data: matches } = useCalendarMatches()
  const { data: feeds } = useCalendarFeeds()
  const running = useRef(false)
  const today = localDay(new Date(), boundary)

  const wanted = useMemo(() => {
    if (!subjects || !deadlines || !matches || !feeds) return null
    // Linked to the user's own Google event: already in Google, not written into "Hoot" again.
    const already = inGoogleAlready(
      matches,
      new Set(feeds.filter((f) => f.source === 'google').map((f) => f.id)),
    )
    const colorOf = (subjectId: string | null | undefined) => {
      const color = subjects.find((s) => s.id === subjectId)?.color ?? null
      return color ? paletteOf(color).hex : null
    }
    const blocks: BlockInput[] = []
    const classes: ClassInput[] = []
    for (let i = 0; i < PUSH_HORIZON_DAYS; i++) {
      const date = addDays(today, i)
      for (const b of dayBlocks.blocksFor(date)) {
        if (b.startMin === null || b.block.status === 'missed') continue
        const minutes = b.actualMinutes ?? b.block.planned_minutes
        blocks.push({
          id: b.block.id,
          start: zonedInstant(date, b.startMin, boundary.timeZone),
          minutes,
          title: b.done ? `✓ ${b.title}` : b.title,
          description: b.sub || null,
          color: b.color ? paletteOf(b.color).hex : null,
        })
      }
      for (const c of agenda.classesFor(date)) {
        if (c.cancelled || already.entries.has(c.entry.id)) continue
        classes.push({
          entryId: c.entry.id,
          date,
          start: zonedInstant(date, c.startMin, boundary.timeZone),
          end: zonedInstant(date, c.endMin, boundary.timeZone),
          title: [c.subject?.name, t(`timetable.kind.${c.entry.kind}`)].filter(Boolean).join(' · '),
          location: c.entry.row.location,
          color: colorOf(c.entry.subjectId),
        })
      }
    }
    const exams = subjects
      .filter((s) => !s.archived)
      .flatMap((s) =>
        shownExams(s.assessments)
          .filter((e) => !already.exams.has(e.id))
          .map((e) => ({
            id: e.id,
            subjectId: s.id,
            from: localDateOf(e.at),
            to: localDateOf(e.date_tentative && e.at_latest ? e.at_latest : e.at),
            title: t('googleCalendar.examTitle', { subject: s.name, exam: e.title }),
            color: colorOf(s.id),
          })),
      )
    const open = deadlines
      .filter((d) => !d.done)
      .map((d) => ({
        id: d.id,
        subjectId: d.subject_id,
        due: new Date(d.due_at),
        title: t('googleCalendar.deadlineTitle', { title: d.title }),
        color: colorOf(d.subject_id),
      }))
    return calendarItems({ blocks, exams, deadlines: open, classes })
  }, [t, today, boundary.timeZone, dayBlocks, agenda, subjects, deadlines, matches, feeds])

  const signature = wanted?.map((w) => `${w.key}:${w.hash}`).join('|') ?? null
  const storedRows = stored.data

  useEffect(() => {
    if (!wanted || !storedRows || !userId || !navigator.onLine) return
    const timer = setTimeout(() => {
      if (running.current) return
      const { upsert, remove } = diffItems(wanted, storedRows, dayStartInstant(today, boundary))
      if (upsert.length === 0 && remove.length === 0) return
      running.current = true
      void (async () => {
        try {
          for (let i = 0; i < upsert.length; i += 200) {
            const { error } = await supabase
              .from('calendar_items')
              .upsert(upsert.slice(i, i + 200), { onConflict: 'user_id,key' })
            if (error) throw error
          }
          for (let i = 0; i < remove.length; i += 200) {
            const { error } = await supabase
              .from('calendar_items')
              .delete()
              .in('key', remove.slice(i, i + 200))
            if (error) throw error
          }
          await googleCall({ op: 'push' })
        } catch {
          // The rows that were written stay; pg_cron pushes them within 15 min.
        } finally {
          running.current = false
          await queryClient.invalidateQueries({ queryKey: calendarItemsKey(userId) })
        }
      })()
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // The signature stands for `wanted`; the stored rows change after each write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, storedRows, userId])

  return null
}

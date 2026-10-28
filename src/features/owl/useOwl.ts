import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { usePeriods, useTimetable } from '@/features/schedule/api'
import { toPeriod } from '@/features/schedule/model'
import { useDayBoundary, useProfile } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { localDay } from '@/lib/day'
import type { ExistingClass } from '@/lib/import'
import { currentTeachingPeriod } from '@/lib/schedule'
import {
  ask,
  giveDocument,
  type DocumentInput,
  type GiveResult,
  type LinkInput,
  type DocumentOrigin,
  type OwlContext,
} from './actions'
import { buildStateSummary } from './stateSummary'
import { useOwlStore } from './store'
import type { ImportKind } from '@shared/schemas.ts'

/** Everything the owl's actions need, bound to the current user and day. */
export function useOwl() {
  const userId = useAuth().session?.user.id
  const { locale } = useLocale()
  const boundary = useDayBoundary()
  const [now] = useState(() => new Date())
  const today = localDay(now, boundary)
  const subjects = useSubjects().data
  const deadlines = useDeadlines().data
  const periods = usePeriods().data
  const timetable = useTimetable().data
  const profile = useProfile().data
  const queryClient = useQueryClient()
  const ensureUser = useOwlStore((s) => s.ensureUser)

  useEffect(() => {
    if (userId) ensureUser(userId)
  }, [userId, ensureUser])

  return useMemo(() => {
    const teaching = currentTeachingPeriod(today, (periods ?? []).map(toPeriod))
    const classes: ExistingClass[] = (timetable ?? [])
      .filter((r) => !teaching || r.period_id === teaching.id)
      .map((r) => ({
        id: r.id,
        subjectId: r.subject_id,
        kind: r.kind,
        weekday: r.weekday,
        startMin: r.start_min,
        endMin: r.end_min,
        location: r.location,
        weekParity: r.week_parity as ExistingClass['weekParity'],
      }))
    const ctx: OwlContext | null = userId
      ? {
          userId,
          locale,
          today,
          subjects: subjects ?? [],
          periods: periods ?? [],
          classes,
          queryClient,
        }
      : null
    return {
      ready: ctx !== null && subjects !== undefined && periods !== undefined,
      classes,
      giveDocument: (
        input: DocumentInput | LinkInput,
        kind: ImportKind,
        note: string | null = null,
        origin: DocumentOrigin | null = null,
      ): Promise<GiveResult> =>
        ctx
          ? giveDocument(input, kind, note, ctx, origin)
          : Promise.resolve({ ok: false, code: 'failed' }),
      ask: (question: string) =>
        ctx
          ? ask(
              question,
              buildStateSummary({
                today,
                subjects: subjects ?? [],
                deadlines: deadlines ?? [],
                periods: periods ?? [],
                globalScale: profile,
              }),
              ctx,
            )
          : Promise.resolve(),
    }
  }, [userId, locale, today, subjects, deadlines, periods, timetable, profile, queryClient])
}

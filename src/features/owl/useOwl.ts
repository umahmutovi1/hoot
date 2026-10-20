import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { usePeriods } from '@/features/schedule/api'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { localDay } from '@/lib/day'
import { ask, giveDocument, type DocumentInput, type OwlContext } from './actions'
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
  const queryClient = useQueryClient()
  const ensureUser = useOwlStore((s) => s.ensureUser)

  useEffect(() => {
    if (userId) ensureUser(userId)
  }, [userId, ensureUser])

  return useMemo(() => {
    const ctx: OwlContext | null = userId
      ? {
          userId,
          locale,
          today,
          subjects: subjects ?? [],
          periods: periods ?? [],
          queryClient,
        }
      : null
    return {
      ready: ctx !== null && subjects !== undefined && periods !== undefined,
      giveDocument: (input: DocumentInput, kind: ImportKind, note: string | null = null) =>
        ctx ? giveDocument(input, kind, note, ctx) : Promise.resolve(),
      ask: (question: string) =>
        ctx
          ? ask(
              question,
              buildStateSummary({
                today,
                subjects: subjects ?? [],
                deadlines: deadlines ?? [],
                periods: periods ?? [],
              }),
              ctx,
            )
          : Promise.resolve(),
    }
  }, [userId, locale, today, subjects, deadlines, periods, queryClient])
}

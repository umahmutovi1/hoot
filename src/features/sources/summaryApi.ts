import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CardSource,
  MaterialCardsResponse,
  SummaryContent,
  SummaryResponse,
  SummaryScope,
} from '@shared/schemas.ts'
import { useAuth } from '@/features/auth/auth-context'
import { invokeAi } from '@/features/owl/api'
import { useLocale } from '@/features/settings/useLocale'
import type { LearnedRate } from '@/lib/estimates/calibration'
import { summaryPace } from '@/lib/estimates/summary'
import { readPages } from '@/lib/readPages'
import { cardsKey } from './api'
import { embedAfterImport } from './importApi'
import { supabase } from '@/lib/supabase'

// Summary and cards from the source text (PRD "Tekst izvora, sažetak i kartice", Sprint 18).
// A summary is made only on tap by the `material` function, which keeps it while the text is
// the same; proposed cards are returned for review and saved like any other card.

export interface UnitSummary {
  id: string
  unitId: string
  scope: SummaryScope
  content: SummaryContent
  words: number
  createdAt: string
}

export const summaryKey = (userId: string | undefined, unitId: string, scope: SummaryScope) =>
  ['summary', userId, unitId, scope] as const
export const summaryInputsKey = (userId: string | undefined) => ['summaryInputs', userId] as const
export const unitsWithTextKey = (userId: string | undefined) => ['unitsWithText', userId] as const

/** The saved summary of a unit (no AI call); null when none was made yet. */
export function useUnitSummary(unitId: string, scope: SummaryScope) {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: summaryKey(userId, unitId, scope),
    enabled: Boolean(userId && unitId),
    queryFn: async (): Promise<UnitSummary | null> => {
      const { data, error } = await supabase
        .from('unit_summaries')
        .select('id, unit_id, scope, content, words, created_at')
        .eq('unit_id', unitId)
        .eq('scope', scope)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        id: data.id,
        unitId: data.unit_id,
        scope: data.scope as SummaryScope,
        content: data.content as unknown as SummaryContent,
        words: data.words,
        createdAt: data.created_at,
      }
    },
  })
}

/** "Napravi sažetak" / "Osvježi sažetak": one AI call, unless the text is unchanged. */
export function useMakeSummary() {
  const userId = useAuth().session?.user.id
  const { locale } = useLocale()
  const queryClient = useQueryClient()
  return useMutation({
    meta: { silent: true },
    mutationFn: async (args: { unitId: string; scope: SummaryScope; refresh?: boolean }) => {
      const r = await invokeAi<SummaryResponse>('material', {
        op: 'summary',
        unit_id: args.unitId,
        scope: args.scope,
        locale,
        ...(args.refresh ? { refresh: true } : {}),
      })
      const summary: UnitSummary = {
        id: r.id,
        unitId: r.unit_id,
        scope: r.scope,
        content: r.content,
        words: r.words,
        createdAt: r.created_at,
      }
      queryClient.setQueryData(summaryKey(userId, args.unitId, args.scope), summary)
      return summary
    },
    // A unit's summary length is a plan input ("Sažetak umjesto čitanja").
    onSuccess: () => queryClient.invalidateQueries({ queryKey: summaryInputsKey(userId) }),
  })
}

/** AI proposal of 5–15 cards; nothing is saved until the user keeps them. */
export function useProposeCards() {
  const { locale } = useLocale()
  return useMutation({
    meta: { silent: true, planInput: false },
    mutationFn: async (args: { unitId: string; from: CardSource; text?: string }) => {
      const r = await invokeAi<MaterialCardsResponse>('material', {
        op: 'cards',
        unit_id: args.unitId,
        from: args.from,
        locale,
        ...(args.from === 'pasted' ? { text: args.text } : {}),
      })
      return r.cards
    },
  })
}

/** Saves the kept cards as the unit's cards (origin `ai`), first review on `firstReview`. */
export function useAddMaterialCards() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      unitId: string
      cards: { front: string; back: string }[]
      firstReview: string
    }) => {
      const rows = args.cards.map((c) => ({
        id: crypto.randomUUID(),
        unit_id: args.unitId,
        front: c.front.slice(0, 500),
        back: c.back.slice(0, 2000),
        origin: 'ai' as const,
        next_review_on: args.firstReview,
      }))
      const { error } = await supabase.from('cards').insert(rows)
      if (error) throw error
      embedAfterImport()
      return rows.length
    },
    onSettled: (_d, _e, args) =>
      queryClient.invalidateQueries({ queryKey: cardsKey(userId, args.unitId) }),
  })
}

/** Units that have source text (their first passage), for "Koristi sažetak" and the tutor. */
export function useUnitsWithText() {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: unitsWithTextKey(userId),
    enabled: Boolean(userId),
    // The cache is persisted as JSON, where a Set turns into {}: keep ids, build the Set in select.
    queryFn: async (): Promise<string[]> => {
      const rows = await readPages((from, to) =>
        supabase
          .from('source_chunks')
          .select('unit_id')
          .eq('position', 0)
          .order('unit_id')
          .range(from, to),
      )
      return rows.map((r) => r.unit_id)
    },
    select: idSet,
  })
}

const idSet = (ids: string[] | unknown): Set<string> =>
  new Set(Array.isArray(ids) ? (ids as string[]) : [])

export interface SummaryInputs {
  words: Map<string, number>
  pace: LearnedRate
}

interface CachedSummaryInputs {
  words: [string, number][]
  pace: LearnedRate
}

const toSummaryInputs = (c: CachedSummaryInputs): SummaryInputs => ({
  words: new Map(Array.isArray(c.words) ? c.words : []),
  pace: c.pace,
})

/** Plan input: each unit's summary length and the summary pace from timer sessions. */
export function useSummaryInputs() {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: summaryInputsKey(userId),
    enabled: Boolean(userId),
    // Persisted as JSON (a Map would come back as {}): cached as entries, the Map is built in select.
    queryFn: async (): Promise<CachedSummaryInputs> => {
      const [summaries, samples] = await Promise.all([
        readPages((from, to) =>
          supabase
            .from('unit_summaries')
            .select('unit_id, words')
            .eq('scope', 'unit')
            .order('unit_id')
            .range(from, to),
        ),
        readPages((from, to) =>
          supabase
            .from('session_units')
            .select('session_id, unit_id, minutes, summary_words')
            .not('summary_words', 'is', null)
            .order('session_id')
            .range(from, to),
        ),
      ])
      return {
        words: summaries.map((s): [string, number] => [s.unit_id, s.words]),
        pace: summaryPace(
          samples.map((s) => ({ minutes: Number(s.minutes), words: s.summary_words ?? 0 })),
        ),
      }
    },
    select: toSummaryInputs,
  })
}

import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { useSummaryInputs, useUnitsWithText } from '@/features/sources/summaryApi'
import { summaryMinutes } from '@/lib/estimates/summary'
import { summaryOffer, type SummaryOffer } from '@/lib/scheduler'
import { supabase } from '@/lib/supabase'
import { invalidatePlanInputs, useAllSources } from './api'
import { usePlanStore } from './store'

/** "Sažetak umjesto čitanja" for a goal with a deficit; null when there is nothing to offer. */
export function useSummaryOffer(goalId: string): SummaryOffer | null {
  const model = usePlanStore((s) => s.model)
  const withText = useUnitsWithText().data
  const inputs = useSummaryInputs().data
  const sources = useAllSources().data
  return useMemo(() => {
    if (!model || !withText || !inputs || !sources) return null
    // Units already switched are planned at their summary time; they are not offered again.
    const switched = new Set(
      sources.flatMap((s) => s.units.filter((u) => u.use_summary).map((u) => u.id)),
    )
    const eligible = new Set([...withText].filter((id) => !switched.has(id)))
    return summaryOffer(model.built.state, model.result, goalId, eligible, (id, reading) =>
      summaryMinutes(reading, inputs.words.get(id) ?? null, inputs.pace),
    )
  }, [model, withText, inputs, sources, goalId])
}

/** "Koristi sažetke" (`use: true`) or back to reading (`use: false`); the plan follows. */
export function useSetSummaryStudy() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ unitIds, use }: { unitIds: string[]; use: boolean }) => {
      const { error } = await supabase.from('units').update({ use_summary: use }).in('id', unitIds)
      if (error) throw error
    },
    onSettled: () => invalidatePlanInputs(queryClient, userId),
  })
}

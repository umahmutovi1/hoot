import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MAX_LINK_QUESTIONS,
  type LinkQuestionsResponse,
  type QuestionLinkSuggestion,
} from '@shared/schemas.ts'
import { useAuth } from '@/features/auth/auth-context'
import { invokeAi } from '@/features/owl/api'
import { embedPending } from '@/features/owl/embeddings'
import { questionLinksKey } from '@/features/plan/api'
import { useLocale } from '@/features/settings/useLocale'
import { supabase } from '@/lib/supabase'

// Exam question ↔ chapter suggestions (PRD "Izvor Pitanja", odluka Etapa 10): vectors first (no
// LLM), then one AI call per 60 questions picks among the nearest chapters. Nothing is written
// until the user saves the review.

/**
 * Suggestions for the questions that have no direct link yet. Runs once per screen visit; a new
 * visit asks again (e.g. after chapters were added).
 */
export function useLinkSuggestions(questionIds: string[] | null) {
  const userId = useAuth().session?.user.id
  const { locale } = useLocale()
  return useQuery({
    queryKey: ['links-suggest', userId, questionIds] as const,
    enabled: Boolean(userId) && questionIds !== null,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    queryFn: async (): Promise<QuestionLinkSuggestion[]> => {
      if (!questionIds || questionIds.length === 0) return []
      await embedPending()
      const out: QuestionLinkSuggestion[] = []
      for (let i = 0; i < questionIds.length; i += MAX_LINK_QUESTIONS) {
        const { links } = await invokeAi<LinkQuestionsResponse>('link-questions', {
          locale,
          question_ids: questionIds.slice(i, i + MAX_LINK_QUESTIONS),
        })
        out.push(...links)
      }
      return out
    },
  })
}

export interface LinkChoice {
  question_id: string
  unit_id: string
  /** false = "Preskoči": kept as the user's rejection, so the AI does not suggest it again. */
  accept: boolean
}

export function useSaveLinks() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (choices: LinkChoice[]) => {
      if (choices.length === 0) return
      const rows = choices.map((c) => ({
        question_id: c.question_id,
        unit_id: c.unit_id,
        assigned_by: c.accept ? ('ai' as const) : ('user' as const),
        linked: c.accept,
      }))
      const { error } = await supabase
        .from('question_links')
        .upsert(rows, { onConflict: 'question_id,unit_id' })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: questionLinksKey(userId) }),
  })
}

/** The user links or unlinks one question and chapter by hand (always 'user', never replaced). */
export function useSetLink() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (link: { question_id: string; unit_id: string; linked: boolean }) => {
      const { error } = await supabase
        .from('question_links')
        .upsert({ ...link, assigned_by: 'user' }, { onConflict: 'question_id,unit_id' })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: questionLinksKey(userId) }),
  })
}

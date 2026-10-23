import { useMutation, useQuery } from '@tanstack/react-query'
import type {
  ProposeAnswerOutput,
  RecallAiSource,
  RecallQuestionsResponse,
} from '@shared/schemas.ts'
import { useAuth } from '@/features/auth/auth-context'
import { invokeAi } from '@/features/owl/api'
import { useLocale } from '@/features/settings/useLocale'
import { uploadImportFile } from '@/features/sources/importApi'

// AI recall questions (PRD "Testiranje bez sadržaja literature", Stage 10). One call per chapter
// and source; the answer stays cached for the visit, so going back and forth costs nothing.

/** Questions from the notes or from general knowledge; runs once `enabled` (the user asked). */
export function useRecallQuestions(
  unitId: string,
  source: Exclude<RecallAiSource, 'page_photo'>,
  count: number,
  enabled: boolean,
) {
  const userId = useAuth().session?.user.id
  const { locale } = useLocale()
  return useQuery({
    queryKey: ['recall-ai', userId, unitId, source, count] as const,
    enabled: Boolean(userId) && enabled,
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const r = await invokeAi<RecallQuestionsResponse>('recall-questions', {
        unit_id: unitId,
        source,
        count,
        locale,
        files: [],
      })
      return r.questions
    },
  })
}

/** Questions from a photo of a page or two; the photo is deleted after the call. */
export function usePagePhotoQuestions(unitId: string, count: number) {
  const userId = useAuth().session?.user.id
  const { locale } = useLocale()
  return useMutation({
    mutationFn: async (photos: File[]) => {
      if (!userId) throw new Error('signed out')
      const files = await Promise.all(photos.map((f) => uploadImportFile(userId, f, 'recall')))
      const r = await invokeAi<RecallQuestionsResponse>('recall-questions', {
        unit_id: unitId,
        source: 'page_photo',
        count,
        locale,
        files,
      })
      return r.questions
    },
  })
}

/** "Predloži odgovor" for an exam question without one; shown marked "provjeri". */
export function useProposeAnswer() {
  const { locale } = useLocale()
  return useMutation({
    mutationFn: async (questionId: string) => {
      const r = await invokeAi<ProposeAnswerOutput>('propose-answer', {
        question_id: questionId,
        locale,
      })
      return r.answer
    },
  })
}

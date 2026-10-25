import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { invokeAi } from '@/features/owl/api'
import { profileKey, useProfile } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import type { AcademicSearch, FoundDocument, PageText } from '@shared/schemas'

/** The last web search kept on the profile (`profiles.academic_search`), if any. */
export function useAcademicSearch(): AcademicSearch | null {
  const { data: profile } = useProfile()
  const value = profile?.academic_search as AcademicSearch | null | undefined
  return value && Array.isArray(value.documents) ? value : null
}

/**
 * "Fakultet s interneta": find-academic-info with the faculty, programme and year only. The
 * function answers the same search from the profile without a new AI call.
 */
export function useFindAcademicInfo() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  const { data: profile } = useProfile()
  const { locale } = useLocale()
  return useMutation({
    mutationFn: async (academicYear: string) => {
      if (!profile?.institution) return { documents: [] as FoundDocument[], cached: true }
      return invokeAi<{ documents: FoundDocument[]; cached: boolean }>('find-academic-info', {
        op: 'search',
        institution: profile.institution,
        program: profile.study_program,
        year_of_study: profile.year_of_study,
        academic_year: academicYear,
        locale,
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: profileKey(userId) }),
  })
}

export type FetchedDocument =
  | { kind: 'file'; path: string; media_type: 'application/pdf'; title: string }
  | { kind: 'text'; pages: PageText[]; title: string }

/** Downloads a found document on the server (the browser cannot, CORS). */
export const fetchFoundDocument = (url: string) =>
  invokeAi<FetchedDocument>('find-academic-info', { op: 'fetch', url })

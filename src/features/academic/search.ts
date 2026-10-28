import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { AiCallError, invokeAi } from '@/features/owl/api'
import type { DocumentInput } from '@/features/owl/actions'
import { profileKey, useProfile } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { supabase } from '@/lib/supabase'
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

type FetchedDocument =
  | { kind: 'file'; path: string; media_type: string; title: string }
  | { kind: 'text'; pages: PageText[]; title: string }

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * A found document, or any public link the user pasted, as a document for the assistant. The
 * server downloads it (the browser cannot, CORS): a PDF or an image comes back through Storage and
 * is removed there at once, a web page as its text.
 */
export async function documentFromLink(
  url: string,
): Promise<{ input: DocumentInput; title: string }> {
  const got = await invokeAi<FetchedDocument>('find-academic-info', { op: 'fetch', url })
  if (got.kind === 'text')
    return {
      input: { type: 'text', text: got.pages.map((p) => p.text).join('\n\n') },
      title: got.title,
    }
  const { data } = await supabase.storage.from('uploads').download(got.path)
  await supabase.storage.from('uploads').remove([got.path])
  if (!data) throw new AiCallError('failed')
  const name = `${got.title.slice(0, 80)}.${EXTENSIONS[got.media_type] ?? 'pdf'}`
  return {
    input: { type: 'file', file: new File([data], name, { type: got.media_type }) },
    title: got.title,
  }
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { Locale } from '@/lib/locale'
import { useAuth } from '@/features/auth/auth-context'

export type Profile = Tables<'profiles'>

export const profileKey = (userId: string | undefined) => ['profile', userId] as const

export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: profileKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateLocale() {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (locale: Locale) => {
      const { error } = await supabase.from('profiles').update({ locale }).eq('id', userId!)
      if (error) throw error
    },
    onMutate: (locale) => {
      queryClient.setQueryData<Profile>(profileKey(userId), (old) =>
        old ? { ...old, locale } : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: profileKey(userId) }),
  })
}

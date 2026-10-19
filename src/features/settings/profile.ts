import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { Locale } from '@/lib/locale'
import { DEFAULT_BOUNDARY, type DayBoundary } from '@/lib/day'
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

/** Day boundary from the profile (defaults until it loads): 04:00 in the user's zone. */
export function useDayBoundary(): DayBoundary {
  const { data: profile } = useProfile()
  const timeZone = profile?.timezone ?? DEFAULT_BOUNDARY.timeZone
  const dayStartMin = profile?.day_start_min ?? DEFAULT_BOUNDARY.dayStartMin
  return useMemo(() => ({ timeZone, dayStartMin }), [timeZone, dayStartMin])
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

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(1, 'validation.required').max(40, 'validation.tooLong'),
})

/** Saves the name and marks it confirmed, so the first-run question is not asked again. */
export function useUpdateDisplayName() {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (displayName: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName, name_confirmed_at: new Date().toISOString() })
        .eq('id', userId!)
      if (error) throw error
    },
    onMutate: (displayName) => {
      queryClient.setQueryData<Profile>(profileKey(userId), (old) =>
        old
          ? { ...old, display_name: displayName, name_confirmed_at: new Date().toISOString() }
          : old,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: profileKey(userId) }),
  })
}

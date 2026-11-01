import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthState = { session: Session | null; loading: boolean }

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

/** Whether this account can sign in with a password (set here, flag in `user_metadata`). */
export function useHasPassword(): boolean {
  return Boolean(useAuth().session?.user.user_metadata?.password_set)
}

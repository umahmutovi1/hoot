import { supabase } from '@/lib/supabase'

export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

/** Lets the installed PWA sign in with the code from the email (links open in the browser). */
export async function verifyEmailCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** After the first sign-in with a code (PRD "Dopune, 29. okt 2026" → Prijava). */
export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/**
 * Google through Supabase OAuth, in the same window: the installed iOS app comes back to its own
 * scope (and storage) instead of ending up in Safari, which a popup would.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

/** Sets or changes the password; `password_set` hides the one-time prompt for good. */
export async function setPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } })
  if (error) throw error
}

/** "Preskoči" on the one-time prompt; the password stays available in Postavke. */
export async function skipPasswordPrompt() {
  const { error } = await supabase.auth.updateUser({ data: { password_prompted: true } })
  if (error) throw error
}

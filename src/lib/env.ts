import { z } from 'zod'

/** `VITE_X=` (as `.env.example` ships it) reads as an empty string: the same as not set. */
const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional())

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /** Web Push (VAPID) public key; without it the app offers no notifications. */
  VITE_VAPID_PUBLIC_KEY: optional,
  /** Google Drive Picker (Sprint 13, SETUP 5c); without all three there is no Drive option. */
  VITE_GOOGLE_CLIENT_ID: optional,
  VITE_GOOGLE_PICKER_API_KEY: optional,
  VITE_GOOGLE_APP_ID: optional,
})

export const env = envSchema.parse(import.meta.env)

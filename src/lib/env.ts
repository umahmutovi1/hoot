import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /** Web Push (VAPID) public key; without it the app offers no notifications. */
  VITE_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
})

export const env = envSchema.parse(import.meta.env)

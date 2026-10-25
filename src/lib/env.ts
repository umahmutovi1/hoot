import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /** Web Push (VAPID) public key; without it the app offers no notifications. */
  VITE_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  /** Google Drive Picker (Stage 10c, SETUP 5c); without all three there is no Drive option. */
  VITE_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  VITE_GOOGLE_PICKER_API_KEY: z.string().min(1).optional(),
  VITE_GOOGLE_APP_ID: z.string().min(1).optional(),
})

export const env = envSchema.parse(import.meta.env)

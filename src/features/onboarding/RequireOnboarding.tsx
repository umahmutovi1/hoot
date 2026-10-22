import { Navigate, Outlet } from 'react-router-dom'
import { useProfile } from '@/features/settings/profile'

/**
 * Sends a user who has never started onboarding there once. After the first step the app is
 * open (step 2 imports through other screens); "Nastavi uvod" leads back until it is finished.
 */
export function RequireOnboarding() {
  const { data: profile } = useProfile()
  if (profile && !profile.onboarded_at && profile.onboarding_step === 0)
    return <Navigate to="/onboarding" replace />
  return <Outlet />
}

import { Navigate, Outlet } from 'react-router-dom'
import { useProfile } from '@/features/settings/profile'

/** Sends a signed-in user who has not confirmed a display name to the welcome question. */
export function RequireName() {
  const { data: profile } = useProfile()
  if (profile && !profile.name_confirmed_at) return <Navigate to="/welcome" replace />
  return <Outlet />
}

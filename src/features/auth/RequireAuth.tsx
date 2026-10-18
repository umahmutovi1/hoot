import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { SplashScreen } from '@/components/SplashScreen'
import { useAuth } from './auth-context'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <SplashScreen />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

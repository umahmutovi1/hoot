import { useIsRestoring } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { SplashScreen } from '@/components/SplashScreen'
import { LandingPage } from '@/features/landing/LandingPage'
import { useAuth } from './auth-context'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  // The persisted cache comes back from IndexedDB asynchronously. Rendering before it would show
  // empty states for a moment ("Dodaj predmet" on Today) and then jump to the real screen.
  const restoring = useIsRestoring()

  if (loading || restoring) return <SplashScreen />
  // Signed out on `/` in the browser: the landing page. The installed app goes straight to login.
  if (!session && location.pathname === '/' && !isStandalone()) return <LandingPage />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

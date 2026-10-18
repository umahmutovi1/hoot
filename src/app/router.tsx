import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { PlanPage } from '@/features/plan/PlanPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { SessionStartPage } from '@/features/session/SessionStartPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SubjectsPage } from '@/features/subjects/SubjectsPage'
import { TodayPage } from '@/features/today/TodayPage'
import { AppShell } from './layout/AppShell'
import { PlainLayout } from './layout/PlainLayout'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <TodayPage /> },
          { path: 'plan', element: <PlanPage tab="calendar" /> },
          { path: 'plan/schedule', element: <PlanPage tab="schedule" /> },
          { path: 'subjects', element: <SubjectsPage /> },
          { path: 'progress', element: <ProgressPage /> },
        ],
      },
      {
        element: <PlainLayout />,
        children: [
          { path: 'settings', element: <SettingsPage /> },
          { path: 'session/start', element: <SessionStartPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

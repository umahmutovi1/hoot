import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequireName } from '@/features/onboarding/RequireName'
import { WelcomePage } from '@/features/onboarding/WelcomePage'
import { PlanPage } from '@/features/plan/PlanPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { SourceEditorPage } from '@/features/sources/SourceEditorPage'
import { SourcePage } from '@/features/sources/SourcePage'
import { UnitPage } from '@/features/sources/UnitPage'
import { ExamScopePage } from '@/features/sources/ExamScopePage'
import { SessionStartPage } from '@/features/session/SessionStartPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SubjectFormPage } from '@/features/subjects/SubjectFormPage'
import { SubjectPage } from '@/features/subjects/SubjectPage'
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
        element: <PlainLayout />,
        children: [{ path: 'welcome', element: <WelcomePage /> }],
      },
      {
        element: <RequireName />,
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
              { path: 'subjects/new', element: <SubjectFormPage /> },
              { path: 'subjects/:id', element: <SubjectPage /> },
              { path: 'subjects/:id/edit', element: <SubjectFormPage /> },
              { path: 'subjects/:id/sources/new', element: <SourceEditorPage /> },
              { path: 'subjects/:id/sources/:sourceId', element: <SourcePage /> },
              { path: 'subjects/:id/sources/:sourceId/edit', element: <SourceEditorPage /> },
              { path: 'subjects/:id/sources/:sourceId/units/:unitId', element: <UnitPage /> },
              { path: 'subjects/:id/scope', element: <ExamScopePage /> },
              { path: 'session/start', element: <SessionStartPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

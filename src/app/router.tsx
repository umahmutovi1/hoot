import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequireName } from '@/features/onboarding/RequireName'
import { WelcomePage } from '@/features/onboarding/WelcomePage'
import { DocumentPage, DocumentsPage } from '@/features/owl/DocumentsPage'
import { ImportReviewPage } from '@/features/owl/ImportReviewPage'
import { OwlChatPage } from '@/features/owl/OwlChatPage'
import { OwlHistoryPage } from '@/features/owl/OwlHistoryPage'
import { PlanPage } from '@/features/plan/PlanPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { SourceEditorPage } from '@/features/sources/SourceEditorPage'
import { SourcePage } from '@/features/sources/SourcePage'
import { UnitPage } from '@/features/sources/UnitPage'
import { ExamScopePage } from '@/features/sources/ExamScopePage'
import { AcademicCalendarPage } from '@/features/schedule/AcademicCalendarPage'
import { AvailabilityPage } from '@/features/schedule/AvailabilityPage'
import { TimetablePage } from '@/features/schedule/TimetablePage'
import { SessionEndPage } from '@/features/session/SessionEndPage'
import { SessionDetailPage } from '@/features/session/SessionDetailPage'
import { SessionPage } from '@/features/session/SessionPage'
import { SessionsPage } from '@/features/session/SessionsPage'
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
              { path: 'chat', element: <OwlChatPage /> },
              { path: 'owl', element: <Navigate to="/chat" replace /> },
            ],
          },
          {
            element: <PlainLayout />,
            children: [
              { path: 'settings', element: <SettingsPage /> },
              { path: 'settings/calendar', element: <AcademicCalendarPage /> },
              { path: 'settings/documents', element: <DocumentsPage /> },
              { path: 'settings/documents/:id', element: <DocumentPage /> },
              { path: 'chat/history', element: <OwlHistoryPage /> },
              { path: 'chat/import/:id', element: <ImportReviewPage /> },
              { path: 'plan/availability', element: <AvailabilityPage /> },
              { path: 'plan/timetable', element: <TimetablePage /> },
              { path: 'subjects/new', element: <SubjectFormPage /> },
              { path: 'subjects/:id', element: <SubjectPage /> },
              { path: 'subjects/:id/edit', element: <SubjectFormPage /> },
              { path: 'subjects/:id/sources/new', element: <SourceEditorPage /> },
              { path: 'subjects/:id/sources/:sourceId', element: <SourcePage /> },
              { path: 'subjects/:id/sources/:sourceId/edit', element: <SourceEditorPage /> },
              { path: 'subjects/:id/sources/:sourceId/units/:unitId', element: <UnitPage /> },
              { path: 'subjects/:id/scope', element: <ExamScopePage /> },
              { path: 'session', element: <SessionPage /> },
              { path: 'session/:id/end', element: <SessionEndPage /> },
              { path: 'sessions', element: <SessionsPage /> },
              { path: 'sessions/:id', element: <SessionDetailPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

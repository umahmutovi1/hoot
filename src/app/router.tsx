import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequireOnboarding } from '@/features/onboarding/RequireOnboarding'
import { TodayPage } from '@/features/today/TodayPage'
import { AppShell } from './layout/AppShell'
import { PlainLayout } from './layout/PlainLayout'
import { RouteError } from './RouteError'
import { SplashScreen } from '@/components/SplashScreen'
import type { ComponentType } from 'react'

/**
 * A screen in its own chunk, loaded when its route is first opened (the service worker precaches
 * the chunks, so they also open offline). Danas, the shell and the login stay in the main chunk.
 */
function page<M extends Record<string, unknown>, K extends keyof M>(
  load: () => Promise<M>,
  name: K,
) {
  return async () => ({ Component: (await load())[name] as ComponentType })
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <SplashScreen />,
    children: [
      {
        element: <PlainLayout />,
        children: [
          {
            path: 'onboarding',
            lazy: page(() => import('@/features/onboarding/OnboardingPage'), 'OnboardingPage'),
          },
        ],
      },
      {
        element: <RequireOnboarding />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <TodayPage /> },
              { path: 'plan', lazy: page(() => import('@/features/plan/PlanPage'), 'PlanPage') },
              { path: 'plan/schedule', element: <Navigate to="/plan" replace /> },
              {
                path: 'subjects',
                lazy: page(() => import('@/features/subjects/SubjectsPage'), 'SubjectsPage'),
              },
              {
                path: 'progress',
                lazy: page(() => import('@/features/progress/ProgressPage'), 'ProgressPage'),
              },
              {
                path: 'progress/week',
                lazy: page(
                  () => import('@/features/strategist/WeeklyReviewPage'),
                  'WeeklyReviewPage',
                ),
              },
              {
                path: 'progress/suggestions',
                lazy: page(() => import('@/features/strategist/ProposalsPage'), 'ProposalsPage'),
              },
              {
                path: 'progress/points',
                lazy: page(() => import('@/features/progress/PointsPage'), 'PointsPage'),
              },
              {
                path: 'progress/points/:id',
                lazy: page(() => import('@/features/progress/PointsEditPage'), 'PointsEditPage'),
              },
              {
                path: 'chat',
                lazy: page(() => import('@/features/owl/OwlChatPage'), 'OwlChatPage'),
              },
              { path: 'owl', element: <Navigate to="/chat" replace /> },
              { path: 'welcome', element: <Navigate to="/onboarding" replace /> },
              {
                path: 'settings',
                lazy: page(() => import('@/features/settings/SettingsPage'), 'SettingsPage'),
              },
              {
                path: 'today/free',
                lazy: page(() => import('@/features/session/FreeSessionPage'), 'FreeSessionPage'),
              },
              {
                path: 'today/fresh',
                lazy: page(() => import('@/features/plan/FreshStartPage'), 'FreshStartPage'),
              },
              {
                path: 'today/moodle',
                lazy: page(
                  () => import('@/features/calendars/DeadlinesImportPage'),
                  'DeadlinesImportPage',
                ),
              },
              {
                path: 'today/calendar',
                lazy: page(
                  () => import('@/features/calendars/CalendarImportPage'),
                  'CalendarImportPage',
                ),
              },
              {
                path: 'settings/calendar',
                lazy: page(
                  () => import('@/features/schedule/AcademicCalendarPage'),
                  'AcademicCalendarPage',
                ),
              },
              {
                path: 'settings/appearance',
                lazy: page(() => import('@/features/settings/AppearancePage'), 'AppearancePage'),
              },
              {
                path: 'settings/academic',
                lazy: page(() => import('@/features/academic/FacultyPage'), 'FacultyPage'),
              },
              {
                path: 'settings/academic/found',
                lazy: page(() => import('@/features/academic/FoundPage'), 'FoundPage'),
              },
              {
                path: 'settings/documents',
                lazy: page(() => import('@/features/owl/DocumentsPage'), 'DocumentsPage'),
              },
              {
                path: 'settings/feeds',
                lazy: page(
                  () => import('@/features/calendars/CalendarFeedsPage'),
                  'CalendarFeedsPage',
                ),
              },
              {
                path: 'settings/documents/:id',
                lazy: page(() => import('@/features/owl/DocumentsPage'), 'DocumentPage'),
              },
              {
                path: 'chat/history',
                lazy: page(() => import('@/features/owl/OwlHistoryPage'), 'OwlHistoryPage'),
              },
              {
                path: 'chat/import/:id',
                lazy: page(() => import('@/features/owl/ImportReviewPage'), 'ImportReviewPage'),
              },
              {
                path: 'plan/availability',
                lazy: page(
                  () => import('@/features/schedule/AvailabilityPage'),
                  'AvailabilityPage',
                ),
              },
              {
                path: 'plan/timetable',
                lazy: page(() => import('@/features/schedule/TimetablePage'), 'TimetablePage'),
              },
              {
                path: 'subjects/new',
                lazy: page(() => import('@/features/subjects/SubjectFormPage'), 'SubjectFormPage'),
              },
              {
                path: 'subjects/:id',
                lazy: page(() => import('@/features/subjects/SubjectPage'), 'SubjectPage'),
              },
              {
                path: 'subjects/:id/edit',
                lazy: page(() => import('@/features/subjects/SubjectFormPage'), 'SubjectFormPage'),
              },
              {
                path: 'subjects/:id/sources/new',
                lazy: page(() => import('@/features/sources/SourceEditorPage'), 'SourceEditorPage'),
              },
              {
                path: 'subjects/:id/sources/:sourceId',
                lazy: page(() => import('@/features/sources/SourcePage'), 'SourcePage'),
              },
              {
                path: 'subjects/:id/sources/:sourceId/edit',
                lazy: page(() => import('@/features/sources/SourceEditorPage'), 'SourceEditorPage'),
              },
              {
                path: 'subjects/:id/sources/:sourceId/units/:unitId',
                lazy: page(() => import('@/features/sources/UnitPage'), 'UnitPage'),
              },
              {
                path: 'subjects/:id/sources/:sourceId/links',
                lazy: page(
                  () => import('@/features/sources/QuestionLinksPage'),
                  'QuestionLinksPage',
                ),
              },
              {
                path: 'subjects/:id/scope',
                lazy: page(() => import('@/features/sources/ExamScopePage'), 'ExamScopePage'),
              },
              {
                path: 'sessions',
                lazy: page(() => import('@/features/session/SessionsPage'), 'SessionsPage'),
              },
              {
                path: 'sessions/:id',
                lazy: page(
                  () => import('@/features/session/SessionDetailPage'),
                  'SessionDetailPage',
                ),
              },
            ],
          },
          {
            // The running session and its end form are full-screen flows without the top bar.
            element: <PlainLayout />,
            children: [
              {
                path: 'session',
                lazy: page(() => import('@/features/session/SessionPage'), 'SessionPage'),
              },
              {
                path: 'session/:id/end',
                lazy: page(() => import('@/features/session/SessionEndPage'), 'SessionEndPage'),
              },
              {
                path: 'session/recall',
                lazy: page(() => import('@/features/review/RecallGatePage'), 'RecallGatePage'),
              },
              {
                path: 'session/review',
                lazy: page(() => import('@/features/review/CheckPage'), 'CheckPage'),
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

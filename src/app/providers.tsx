import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { Recalibrator } from '@/features/session/Recalibrator'
import { FsrsOptimizer } from '@/features/review/FsrsOptimizer'
import { queryPersister } from './queryPersister'
import { CalendarSync } from '@/features/calendars/CalendarSync'
import { EventClassifier } from '@/features/calendars/EventClassifier'
import { GooglePush } from '@/features/calendars/GooglePush'
import { ReplanRunner } from '@/features/plan/ReplanRunner'
import { PushJobsRunner } from '@/features/notify/PushJobsRunner'
import { EmbedRunner } from '@/features/owl/EmbedRunner'
import { SyncRunner } from './SyncRunner'
import { ViewportInsets } from './ViewportInsets'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Kept for the persisted cache: screens opened offline show what they showed last time.
      gcTime: 7 * 24 * 60 * 60_000,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 7 * 24 * 60 * 60_000,
        // Bump when a cached query changes shape.
        buster: '1',
      }}
    >
      <AuthProvider>
        <ViewportInsets />
        <SyncRunner />
        <CalendarSync />
        <GooglePush />
        <EventClassifier />
        <Recalibrator />
        <FsrsOptimizer />
        <ReplanRunner />
        <PushJobsRunner />
        <EmbedRunner />
        {children}
      </AuthProvider>
    </PersistQueryClientProvider>
  )
}

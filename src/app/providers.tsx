import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { Recalibrator } from '@/features/session/Recalibrator'
import { queryPersister } from './queryPersister'
import { SyncRunner } from './SyncRunner'

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
        <SyncRunner />
        <Recalibrator />
        {children}
      </AuthProvider>
    </PersistQueryClientProvider>
  )
}

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { AI_ERRORS, type AiErrorCode, type AiStatus } from '@shared/schemas.ts'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type DocumentRow = Tables<'documents'>

export class AiCallError extends Error {
  readonly code: AiErrorCode | 'offline'
  constructor(code: AiErrorCode | 'offline') {
    super(code)
    this.code = code
  }
}

/** Calls an AI Edge Function; failures become an AiCallError with the function's code. */
export async function invokeAi<T>(name: string, body?: unknown): Promise<T> {
  if (!navigator.onLine) throw new AiCallError('offline')
  const { data, error } = await supabase.functions.invoke<T>(name, {
    method: body === undefined ? 'GET' : 'POST',
    body: body as Record<string, unknown> | undefined,
  })
  if (!error) return data as T
  if (error instanceof FunctionsHttpError) {
    const payload: unknown = await error.context.json().catch(() => null)
    const code = (payload as { error?: string } | null)?.error
    throw new AiCallError(
      AI_ERRORS.includes(code as AiErrorCode) ? (code as AiErrorCode) : 'failed',
    )
  }
  throw new AiCallError(navigator.onLine ? 'failed' : 'offline')
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

export const aiStatusKey = (userId: string | undefined) => ['ai-status', userId] as const

/** Whether the owl can work: online and an AI key configured on the server. */
export function useAiAvailability() {
  const userId = useAuth().session?.user.id
  const online = useOnline()
  const status = useQuery({
    queryKey: aiStatusKey(userId),
    enabled: Boolean(userId) && online,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: () => invokeAi<AiStatus>('ai-status'),
  })
  const state: 'ready' | 'offline' | 'disabled' | 'loading' = !online
    ? 'offline'
    : status.data
      ? status.data.enabled
        ? 'ready'
        : 'disabled'
      : status.isError
        ? 'disabled'
        : 'loading'
  return { state, remaining: status.data?.remaining ?? null }
}

export const documentsKey = (userId: string | undefined) => ['documents', userId] as const

export function useDocuments() {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: documentsKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<DocumentRow[]> => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** The file stays in storage while the document exists; chunks go with the row (cascade). */
export function useDeleteDocument() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (doc: DocumentRow) => {
      if (doc.storage_path) {
        const { error } = await supabase.storage.from('uploads').remove([doc.storage_path])
        if (error) throw error
      }
      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: documentsKey(userId) }),
  })
}

/** A short-lived link to the stored file, opened in a new tab (PDF viewers jump to #page=N). */
export async function openDocumentFile(path: string, page: number | null) {
  const tab = window.open('', '_blank')
  const { data, error } = await supabase.storage.from('uploads').createSignedUrl(path, 300)
  if (error || !data) {
    tab?.close()
    throw error ?? new Error('no url')
  }
  const url = page ? `${data.signedUrl}#page=${page}` : data.signedUrl
  if (tab) tab.location.href = url
  else window.location.href = url
}

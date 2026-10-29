import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { AI_ERRORS, type AiErrorCode, type AiStatus } from '@shared/schemas.ts'
import { useAuth } from '@/features/auth/auth-context'
import { env } from '@/lib/env'
import { sseParser } from '@/lib/sse'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { OwlMessage } from './store'

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

/**
 * An AI Edge Function that answers as server-sent events (the chat): `onDelta` gets the answer
 * text as it is written, the promise the whole response from the "done" event. Errors become
 * an AiCallError like with `invokeAi`.
 */
export async function streamAi<T>(
  name: string,
  body: unknown,
  onDelta: (text: string) => void,
): Promise<T> {
  if (!navigator.onLine) throw new AiCallError('offline')
  const known = (code: unknown): AiErrorCode =>
    AI_ERRORS.includes(code as AiErrorCode) ? (code as AiErrorCode) : 'failed'
  const { data } = await supabase.auth.getSession()
  let res: Response
  try {
    res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session?.access_token ?? env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...(body as object), stream: true }),
    })
  } catch {
    throw new AiCallError(navigator.onLine ? 'failed' : 'offline')
  }
  if (!res.ok || !res.body) {
    const payload: unknown = await res.json().catch(() => null)
    throw new AiCallError(known((payload as { error?: string } | null)?.error))
  }
  // Set by the "done" or "error" event.
  const outcome: { end: { ok: true; data: T } | { ok: false; code: AiErrorCode } | null } = {
    end: null,
  }
  const parser = sseParser((event, raw) => {
    const value = JSON.parse(raw) as { text?: string; error?: string }
    if (event === 'delta' && value.text) onDelta(value.text)
    else if (event === 'done') outcome.end = { ok: true, data: value as T }
    else if (event === 'error') outcome.end = { ok: false, code: known(value.error) }
  })
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      parser.push(value)
    }
  } catch {
    throw new AiCallError(navigator.onLine ? 'failed' : 'offline')
  }
  parser.end()
  const { end } = outcome
  if (!end) throw new AiCallError('failed')
  if (!end.ok) throw new AiCallError(end.code)
  return end.data
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

/**
 * Signed link to a stored document file, fetched ahead so it opens as a plain link in a new tab
 * (no popup blocker, the app window never navigates away). PDF viewers jump to `#page=N`.
 */
export function useDocumentFileUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['document-url', path],
    enabled: Boolean(path),
    staleTime: 8 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('uploads').createSignedUrl(path!, 600)
      if (error) throw error
      return data.signedUrl
    },
  })
}

export type ConversationRow = Tables<'owl_conversations'>

export const conversationsKey = (userId: string | undefined) =>
  ['owl-conversations', userId] as const

/** Past conversations with the owl, newest first. */
export function useConversations() {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: conversationsKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ConversationRow[]> => {
      const { data, error } = await supabase
        .from('owl_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data
    },
  })
}

/** Messages of one conversation, as the chat renders them. */
export async function loadConversationMessages(id: string): Promise<OwlMessage[]> {
  const { data, error } = await supabase
    .from('owl_messages')
    .select('payload')
    .eq('conversation_id', id)
    .order('created_at')
  if (error) throw error
  return data.map((row) => row.payload as unknown as OwlMessage)
}

export function useDeleteConversation() {
  const userId = useAuth().session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('owl_conversations').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: conversationsKey(userId) }),
  })
}

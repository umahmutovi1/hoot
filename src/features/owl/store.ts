import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { SyllabusProposal } from '@/lib/import/syllabus'
import type { AiErrorCode, Citation, ImportKind, ReimportKind } from '@shared/schemas.ts'
import type { ClassProposal, ExamProposal, PeriodProposal } from '@/lib/import'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

// The open conversation with the owl. Every finished message is written to the database
// (owl_conversations / owl_messages) so past conversations show up in the history; the
// current one is also kept on the device for a reload.

/** A shared file or text (same shape as DocumentInput in actions.ts). */
export type SharedInput = { type: 'file'; file: File } | { type: 'text'; text: string }

export type StateRef = { subject: string | null; topic: 'grades' | 'exams' | 'calendar' | 'plan' }

/** A note or card found by "gdje sam pisala o …" (vector search, no LLM). */
export interface NoteHit {
  kind: 'unit' | 'card'
  unitId: string
  subjectId: string
  sourceId: string
  title: string
  snippet: string
}

/** What the app does next to an answer (Stage 10 tools); the user confirms any change. */
export type OwlAction =
  | { kind: 'search_notes'; text: string; hits: NoteHit[] | null }
  | { kind: 'quiz'; text: string }
  | { kind: 'add_timetable' }
  | { kind: 'add_contents'; text: string | null }
  | { kind: 'import_document'; importKind: ReimportKind; documentId: string | null }

export interface ImportProposal {
  documentId: string
  documentTitle: string
  periods: PeriodProposal[]
  exams: ExamProposal[]
  /** Timetable classes; missing in proposals kept from before Stage 10. */
  classes?: ClassProposal[]
  /** Syllabus per subject (Stage 10c). */
  syllabus?: SyllabusProposal[]
  /** Found on the web: link to the source and the year it says it is for. */
  origin?: { url: string; academicYear: string | null } | null
  warnings: string[]
  savedCount: number | null
}

/** A document read in the background (the banner and the system notification). */
export type ImportJob =
  | { status: 'running'; title: string; long: boolean }
  | { status: 'done'; title: string; found: number; proposalId: string | null }
  | { status: 'error'; title: string; code: AiErrorCode | 'offline' | 'file' | 'link' }

export type OwlMessage =
  | { id: string; role: 'user'; type: 'text'; text: string }
  | { id: string; role: 'user'; type: 'file'; name: string; note?: string }
  | {
      id: string
      role: 'owl'
      type: 'answer'
      text: string
      citations: Citation[]
      stateRefs: StateRef[]
      action?: OwlAction
    }
  | {
      id: string
      role: 'owl'
      type: 'pending'
      stage: 'thinking' | 'reading' | 'storing'
      /** A long read (a whole study plan, a scan): "you can leave, I'll let you know". */
      long?: boolean
    }
  | { id: string; role: 'owl'; type: 'error'; code: AiErrorCode | 'offline' | 'file' | 'link' }
  | {
      id: string
      role: 'owl'
      type: 'document'
      /** What the owl did with it: stored only, or stored with a proposal below. */
      kind: string
      title: string
      documentId: string
      /** False when the passages could not be stored; the proposal still stands. */
      stored: boolean
      found: number
      /** Read again from the chat ("ubaci mi ovo"), not newly given. */
      again?: boolean
      /** A syllabus: the year of study it was read for (no subjects found → say which). */
      year?: number | null
    }
  | { id: string; role: 'owl'; type: 'proposal'; proposal: ImportProposal }

interface OwlState {
  userId: string | null
  /** null until the first message of a new conversation is sent. */
  conversationId: string | null
  messages: OwlMessage[]
  /** Kind preselected when the "give a document" sheet opens from a suggestion. */
  sheet: {
    open: boolean
    kind: ImportKind
    nonce: number
    shared?: SharedInput | null
    /** Opens straight on "Link" (Nađeno na internetu: "Imaš link?"). */
    link?: boolean
  }
  busy: boolean
  /**
   * The document being read, or how the last one ended, for the banner outside the chat: the
   * reading keeps going while the user moves around the app.
   */
  job: ImportJob | null
  setJob: (job: ImportJob | null) => void
  /** Forgets the open conversation when another user signs in. */
  ensureUser: (userId: string) => void
  /** An empty conversation; the previous one stays in the history. */
  newConversation: () => void
  /** Opens a conversation from the history. */
  openConversation: (id: string, messages: OwlMessage[]) => void
  push: (message: OwlMessage) => void
  replace: (id: string, message: OwlMessage) => void
  updateProposal: (id: string, update: (p: ImportProposal) => ImportProposal) => void
  setBusy: (busy: boolean) => void
  openSheet: (kind?: ImportKind, opts?: { link?: boolean }) => void
  /** Android "Podijeli" → Hoot: the sheet opens on its confirm step with the shared item. */
  openShared: (input: SharedInput) => void
  closeSheet: () => void
}

// Writes run one after another, so a conversation row exists before its first message.
let writes: Promise<void> = Promise.resolve()
function enqueue(write: () => PromiseLike<{ error: unknown }>) {
  writes = writes.then(async () => {
    const { error } = await write()
    if (error) console.error('owl history write failed', error)
  })
}
/** Resolves when every queued history write has been sent. */
export const historyWritten = () => writes

function titleOf(m: OwlMessage) {
  const text = m.type === 'text' ? m.text : m.type === 'file' ? (m.note ?? m.name) : ''
  return text.replace(/\s+/g, ' ').trim().slice(0, 80)
}

function saveMessage(conversationId: string, m: OwlMessage) {
  if (m.type === 'pending') return
  enqueue(() =>
    supabase.from('owl_messages').upsert({
      id: m.id,
      conversation_id: conversationId,
      role: m.role,
      type: m.type,
      payload: m as unknown as Json,
    }),
  )
  enqueue(() =>
    supabase
      .from('owl_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId),
  )
}

export const useOwlStore = create<OwlState>()(
  persist(
    (set, get) => ({
      userId: null,
      conversationId: null,
      messages: [],
      sheet: { open: false, kind: 'auto', nonce: 0 },
      busy: false,
      job: null,
      setJob: (job) => set({ job }),
      ensureUser: (userId) => {
        if (get().userId !== userId)
          set({ userId, conversationId: null, messages: [], busy: false })
      },
      newConversation: () => {
        if (!get().busy) set({ conversationId: null, messages: [] })
      },
      openConversation: (id, messages) => set({ conversationId: id, messages, busy: false }),
      push: (message) => {
        let { conversationId } = get()
        if (!conversationId && message.role === 'user') {
          conversationId = crypto.randomUUID()
          const id = conversationId
          enqueue(() => supabase.from('owl_conversations').insert({ id, title: titleOf(message) }))
          set({ conversationId })
        }
        set((s) => ({ messages: [...s.messages, message] }))
        if (conversationId) saveMessage(conversationId, message)
      },
      replace: (id, message) => {
        set((s) => ({ messages: s.messages.map((m) => (m.id === id ? message : m)) }))
        const { conversationId } = get()
        if (conversationId) saveMessage(conversationId, message)
      },
      updateProposal: (id, update) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id && m.type === 'proposal' ? { ...m, proposal: update(m.proposal) } : m,
          ),
        }))
        const { conversationId, messages } = get()
        const updated = messages.find((m) => m.id === id)
        if (conversationId && updated) saveMessage(conversationId, updated)
      },
      setBusy: (busy) => set({ busy }),
      openSheet: (kind = 'auto', opts) =>
        set((s) => ({ sheet: { open: true, kind, nonce: s.sheet.nonce + 1, link: opts?.link } })),
      openShared: (shared) =>
        set((s) => ({ sheet: { open: true, kind: 'auto', nonce: s.sheet.nonce + 1, shared } })),
      closeSheet: () => set((s) => ({ sheet: { ...s.sheet, open: false, shared: null } })),
    }),
    {
      name: 'hoot-owl',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // A pending message from a closed tab would spin forever; drop it on reload.
      partialize: (s) => ({
        userId: s.userId,
        conversationId: s.conversationId,
        messages: s.messages.filter((m) => m.type !== 'pending'),
      }),
      // Stage 6 kept one device-only chat per day; it is not in the database, start fresh.
      migrate: () => ({ userId: null, conversationId: null, messages: [] }),
    },
  ),
)

export function findProposal(messages: OwlMessage[], id: string | undefined) {
  const m = messages.find((x) => x.id === id)
  return m?.type === 'proposal' ? m.proposal : undefined
}

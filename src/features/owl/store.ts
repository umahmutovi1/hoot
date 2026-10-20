import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AiErrorCode, Citation, ImportKind } from '@shared/schemas.ts'
import type { ExamProposal, PeriodProposal } from '@/lib/import'

// The conversation with the owl lives only on this device (PRD: history in the database comes
// in Stage 10). It is kept for the current local day, per user.

export type StateRef = { subject: string | null; topic: 'grades' | 'exams' | 'calendar' | 'plan' }

export interface ImportProposal {
  documentId: string
  documentTitle: string
  periods: PeriodProposal[]
  exams: ExamProposal[]
  warnings: string[]
  savedCount: number | null
}

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
    }
  | { id: string; role: 'owl'; type: 'pending'; stage: 'thinking' | 'reading' | 'storing' }
  | { id: string; role: 'owl'; type: 'error'; code: AiErrorCode | 'offline' | 'file' }
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
    }
  | { id: string; role: 'owl'; type: 'proposal'; proposal: ImportProposal }

interface OwlState {
  userId: string | null
  day: string | null
  messages: OwlMessage[]
  /** Kind preselected when the "give a document" sheet opens from a suggestion. */
  sheet: { open: boolean; kind: ImportKind; nonce: number }
  busy: boolean
  /** Starts a fresh conversation when the user or the local day changed. */
  ensureSession: (userId: string, day: string) => void
  push: (message: OwlMessage) => void
  replace: (id: string, message: OwlMessage) => void
  updateProposal: (id: string, update: (p: ImportProposal) => ImportProposal) => void
  setBusy: (busy: boolean) => void
  openSheet: (kind?: ImportKind) => void
  closeSheet: () => void
  clear: () => void
}

export const useOwlStore = create<OwlState>()(
  persist(
    (set, get) => ({
      userId: null,
      day: null,
      messages: [],
      sheet: { open: false, kind: 'auto', nonce: 0 },
      busy: false,
      ensureSession: (userId, day) => {
        const s = get()
        if (s.userId !== userId || s.day !== day) set({ userId, day, messages: [], busy: false })
      },
      push: (message) => set((s) => ({ messages: [...s.messages, message] })),
      replace: (id, message) =>
        set((s) => ({ messages: s.messages.map((m) => (m.id === id ? message : m)) })),
      updateProposal: (id, update) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id && m.type === 'proposal' ? { ...m, proposal: update(m.proposal) } : m,
          ),
        })),
      setBusy: (busy) => set({ busy }),
      openSheet: (kind = 'auto') =>
        set((s) => ({ sheet: { open: true, kind, nonce: s.sheet.nonce + 1 } })),
      closeSheet: () => set((s) => ({ sheet: { ...s.sheet, open: false } })),
      clear: () => set({ messages: [], busy: false }),
    }),
    {
      name: 'hoot-owl',
      storage: createJSONStorage(() => localStorage),
      // A pending message from a closed tab would spin forever; drop it on reload.
      partialize: (s) => ({
        userId: s.userId,
        day: s.day,
        messages: s.messages.filter((m) => m.type !== 'pending'),
      }),
    },
  ),
)

export function findProposal(messages: OwlMessage[], id: string | undefined) {
  const m = messages.find((x) => x.id === id)
  return m?.type === 'proposal' ? m.proposal : undefined
}

import { create } from 'zustand'
import i18n from '@/app/i18n'

// One toast at a time (PRD "Dopune, 29. okt 2026" → Doživljaj): success, error or a plain note,
// optionally with an action (Poništi). Above the bottom edge and the keyboard (--vv-bottom).

/** How long a toast stays; a deferred delete commits after it (SwipeRow, `undoWindow`). */
export const TOAST_MS = 6000

export type ToastKind = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  run: () => void
}

interface ToastState {
  toast: { id: number; message: string; kind: ToastKind; action?: ToastAction } | null
  show: (message: string, action?: ToastAction, kind?: ToastKind) => void
  success: (message: string, action?: ToastAction) => void
  error: (message: string, action?: ToastAction) => void
  hide: () => void
}

let seq = 0

export const useToast = create<ToastState>()((set) => ({
  toast: null,
  show: (message, action, kind = 'info') => set({ toast: { id: ++seq, message, kind, action } }),
  success: (message, action) => set({ toast: { id: ++seq, message, kind: 'success', action } }),
  error: (message, action) => set({ toast: { id: ++seq, message, kind: 'error', action } }),
  hide: () => set({ toast: null }),
}))

/** Thrown by `undoWindow` when the user taps Poništi; mutations roll back and stay silent. */
export class UndoError extends Error {
  constructor() {
    super('undone')
    this.name = 'UndoError'
  }
}

/**
 * Shows `message` with Poništi and resolves when the toast ends, or rejects with `UndoError`
 * on Poništi. Awaited first in a delete's `mutationFn`: the optimistic `onMutate` hides the row at
 * once, and the rollback in `onError` brings it back on undo. Leaving the screen does not cancel.
 */
export function undoWindow(message: string, undoLabel: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, TOAST_MS + 300)
    useToast.getState().show(message, {
      label: undoLabel,
      run: () => {
        clearTimeout(timer)
        reject(new UndoError())
      },
    })
  })
}

/** `undoWindow` with "Obrisano · Poništi"; for deletes from a sheet (`useDelete…({ undo: true })`). */
export const undoDelete = () => undoWindow(i18n.t('common.deleted'), i18n.t('common.undo'))

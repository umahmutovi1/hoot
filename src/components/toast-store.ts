import { create } from 'zustand'

// One toast at a time (undo after "Danas ne mogu" or a block change), above the bottom edge and
// the keyboard (--vv-bottom).

interface ToastState {
  toast: { id: number; message: string; action?: { label: string; run: () => void } } | null
  show: (message: string, action?: { label: string; run: () => void }) => void
  hide: () => void
}

export const useToast = create<ToastState>()((set) => ({
  toast: null,
  show: (message, action) => set({ toast: { id: Date.now(), message, action } }),
  hide: () => set({ toast: null }),
}))

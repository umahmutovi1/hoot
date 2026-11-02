import { create } from 'zustand'
import { VIBRATION, type Milestone } from '@/lib/celebrate'

export type CelebrationKind = Milestone | 'repeated' | 'passed'

interface CelebrationState {
  current: { id: number; kind: CelebrationKind; name?: string } | null
  /** `name`: the subject (passed exam) or the unit ("Ponovljeno"). */
  celebrate: (kind: CelebrationKind, name?: string) => void
  hide: () => void
}

let seq = 0

export const useCelebration = create<CelebrationState>()((set) => ({
  current: null,
  celebrate: (kind, name) => {
    try {
      navigator.vibrate?.(VIBRATION[kind])
    } catch {
      // not supported (iOS Safari) or blocked: the message and ring are enough
    }
    set({ current: { id: ++seq, kind, name } })
  },
  hide: () => set({ current: null }),
}))

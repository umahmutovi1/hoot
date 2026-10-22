import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// UI state of the session flow. The timer itself is never here: it is in the database (segments).

interface SessionUiState {
  /** "Šta učiš sad?" is open (Today hides the owl bar meanwhile). */
  startOpen: boolean
  openStart: () => void
  closeStart: () => void
  /** Last timer mode picked; a new session starts with it. */
  /** Preset id. */
  timerMode: string
  setTimerMode: (mode: string) => void
  /** Unit picked in "Sad radim na" while paused; the next segment starts on it. */
  nextUnit: { sessionId: string; unitId: string | null } | null
  setNextUnit: (next: { sessionId: string; unitId: string | null } | null) => void
  /** Forgotten-timer question answered with "Da, nastavi" for this segment. */
  keptSegmentId: string | null
  keepSegment: (id: string) => void
  /** Subjects whose sessions changed: their calibration is recomputed once online. */
  recalibrate: string[]
  needsRecalibration: (subjectId: string) => void
  recalibrated: (subjectId: string) => void
  /** A session started as a knowledge check (review block or a due check) and its units. */
  check: { sessionId: string; unitIds: string[] } | null
  setCheck: (check: { sessionId: string; unitIds: string[] } | null) => void
}

export const useSessionUi = create<SessionUiState>()(
  persist(
    (set) => ({
      startOpen: false,
      openStart: () => set({ startOpen: true }),
      closeStart: () => set({ startOpen: false }),
      timerMode: 'pomodoro25',
      setTimerMode: (timerMode) => set({ timerMode }),
      nextUnit: null,
      setNextUnit: (nextUnit) => set({ nextUnit }),
      keptSegmentId: null,
      keepSegment: (keptSegmentId) => set({ keptSegmentId }),
      recalibrate: [],
      needsRecalibration: (id) =>
        set((s) => (s.recalibrate.includes(id) ? s : { recalibrate: [...s.recalibrate, id] })),
      recalibrated: (id) => set((s) => ({ recalibrate: s.recalibrate.filter((x) => x !== id) })),
      check: null,
      setCheck: (check) => set({ check }),
    }),
    {
      name: 'hoot-session-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        timerMode: s.timerMode,
        nextUnit: s.nextUnit,
        keptSegmentId: s.keptSegmentId,
        recalibrate: s.recalibrate,
        check: s.check,
      }),
    },
  ),
)

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// Per-device UI state of plan cards: "Kasnije" hides a suggestion for 3 days, "Prihvati rizik"
// hides a deficit until it grows, and the Replan sheet opens once per day.

interface PlanUiState {
  /** Suggestion key → local day until which it stays hidden (inclusive). */
  snoozed: Record<string, string>
  snooze: (key: string, until: string) => void
  /** Goal id → deficit minutes the user accepted ("Prihvati rizik"). */
  accepted: Record<string, number>
  accept: (goalId: string, minutes: number) => void
  /** Total deficit per day (last 7), to see whether it grew since yesterday. */
  deficits: Record<string, number>
  recordDeficit: (day: string, minutes: number) => void
  /** Day the Replan sheet was last shown. */
  replanShownOn: string | null
  markReplanShown: (day: string) => void
}

export const usePlanUi = create<PlanUiState>()(
  persist(
    (set) => ({
      snoozed: {},
      snooze: (key, until) => set((s) => ({ snoozed: { ...s.snoozed, [key]: until } })),
      accepted: {},
      accept: (goalId, minutes) => set((s) => ({ accepted: { ...s.accepted, [goalId]: minutes } })),
      deficits: {},
      recordDeficit: (day, minutes) =>
        set((s) => {
          if (s.deficits[day] === minutes) return s
          const kept = Object.entries({ ...s.deficits, [day]: minutes })
            .sort(([a], [b]) => (a < b ? 1 : -1))
            .slice(0, 7)
          return { deficits: Object.fromEntries(kept) }
        }),
      replanShownOn: null,
      markReplanShown: (day) => set({ replanShownOn: day }),
    }),
    { name: 'hoot-plan-ui', storage: createJSONStorage(() => localStorage) },
  ),
)

/** Days a "Kasnije" hides a card. */
export const SNOOZE_DAYS = 3

import { create } from 'zustand'
import type { PlanResult } from '@/lib/scheduler'
import type { BuiltState } from './state'

// The latest computed plan (state, hash, result), shared by the screens that explain it
// (suggestion cards, Replan sheet, campaign start). The saved blocks are read from the database.

interface PlanModel {
  built: BuiltState
  hash: string
  result: PlanResult
}

interface PlanStore {
  model: PlanModel | null
  setModel: (model: PlanModel) => void
  /** Bumped by "Preračunaj" and quick actions: replan now, without the 2 s debounce. */
  nudge: number
  replanNow: () => void
  /**
   * Free time today grew since the last run (Stage 10b): "Imaš X min više danas" offers it once;
   * the plan never fills it silently.
   */
  extraToday: { date: string; minutes: number } | null
  setExtraToday: (extra: { date: string; minutes: number } | null) => void
}

export const usePlanStore = create<PlanStore>()((set) => ({
  model: null,
  setModel: (model) => set({ model }),
  nudge: 0,
  replanNow: () => set((s) => ({ nudge: s.nudge + 1 })),
  extraToday: null,
  setExtraToday: (extraToday) => set({ extraToday }),
}))

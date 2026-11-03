import { useMemo, useState } from 'react'
import { useDayEnergy } from '@/features/schedule/api'
import { useDayBoundary } from '@/features/settings/profile'
import { localDay } from '@/lib/day'
import type { TFunction } from 'i18next'
import { sessionPresetsSchema, type SessionPreset } from '@shared/schemas.ts'
import { useProfile } from '@/features/settings/profile'
import {
  BUILT_IN_PRESETS,
  customPreset,
  DEFAULT_PRESET_ID,
  isBuiltInPreset,
  resolvePreset,
  type Preset,
} from '@/lib/session/timer'
import { useSessionUi } from './store'

/** Custom presets from the profile; a malformed list counts as none. */
export function parseCustomPresets(value: unknown): SessionPreset[] {
  const parsed = sessionPresetsSchema.safeParse(value)
  return parsed.success ? parsed.data : []
}

export interface PresetChoices {
  /** Built-in presets, then the user's own, in picker order. */
  presets: Preset[]
  custom: SessionPreset[]
  /** The default from Postavke (falls back to Standardno). */
  defaultId: string
  /** 25/5 on a "Nemam energije" day; else the last preset used, when it still exists; else the default. */
  suggestedId: string
  resolve: (id: string | null | undefined) => Preset
}

export function usePresets(): PresetChoices {
  const { data: profile } = useProfile()
  const last = useSessionUi((s) => s.timerMode)
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const low = useDayEnergy().data?.some((e) => e.on_date === today && e.energy === 'low') ?? false
  return useMemo(() => {
    const custom = parseCustomPresets(profile?.session_presets)
    const presets = [...BUILT_IN_PRESETS, ...custom.map(customPreset)]
    const exists = (id: string) => presets.some((p) => p.id === id)
    const defaultId =
      profile?.default_preset && exists(profile.default_preset)
        ? profile.default_preset
        : DEFAULT_PRESET_ID
    // Sprint 7 ids (25/5, 50/10) are not offered any more, so they never come back as a suggestion.
    const suggestedId = low ? 'pomodoro' : last && exists(last) ? last : defaultId
    return {
      presets,
      custom,
      defaultId,
      suggestedId,
      resolve: (id) => resolvePreset(id, custom),
    }
  }, [profile?.session_presets, profile?.default_preset, last, low])
}

/** "Standardno", "25/5", or the custom preset's own name. */
export function presetName(t: TFunction, preset: Preset): string {
  if (preset.kind === 'cycle' && preset.name) return preset.name
  return t(`session.preset.${preset.id as 'standard'}`)
}

/** One line under a preset: "50 min učenja / 15 pauze", "45 → 10 → 45 → 20, ponovi". */
export function presetSummary(t: TFunction, preset: Preset): string {
  if (preset.kind !== 'cycle' || !preset.name) {
    if (isBuiltInPreset(preset.id)) return t(`session.presetSub.${preset.id as 'standard'}`)
  }
  if (preset.kind !== 'cycle') return ''
  const steps = preset.steps.map((s) => s.min).join(' → ')
  return preset.longBreak
    ? t('session.presetSub.customLong', {
        steps,
        every: preset.longBreak.every,
        min: preset.longBreak.min,
      })
    : t('session.presetSub.custom', { steps })
}

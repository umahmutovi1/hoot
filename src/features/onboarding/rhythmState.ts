import type { Profile } from '@/features/settings/profile'
import { DEFAULT_RHYTHM, SLOT_PARTS, type Rhythm, type SlotPart } from '@/lib/schedule/rhythm'

/** The rhythm saved on the profile in step 3, or the defaults. */
export function rhythmOf(profile: Profile | undefined): Rhythm {
  const pair = (v: number[] | null | undefined, d: [number, number]): [number, number] =>
    v && v.length === 2 ? [v[0]!, v[1]!] : d
  return {
    wake: pair(profile?.wake_min, DEFAULT_RHYTHM.wake),
    sleep: pair(profile?.sleep_min, DEFAULT_RHYTHM.sleep),
  }
}

export function partsOf(profile: Profile | undefined): SlotPart[] {
  return (profile?.preferred_slots ?? []).filter((p): p is SlotPart =>
    (SLOT_PARTS as readonly string[]).includes(p),
  )
}

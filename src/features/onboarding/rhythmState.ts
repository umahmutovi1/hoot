import type { Profile } from '@/features/settings/profile'
import { rhythmFrom, SLOT_PARTS, type Rhythm, type SlotPart } from '@/lib/schedule/rhythm'

/** The rhythm saved on the profile in step 3, or the defaults. */
export function rhythmOf(profile: Profile | undefined): Rhythm {
  return rhythmFrom(profile)
}

export function partsOf(profile: Profile | undefined): SlotPart[] {
  return (profile?.preferred_slots ?? []).filter((p): p is SlotPart =>
    (SLOT_PARTS as readonly string[]).includes(p),
  )
}

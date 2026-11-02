import { subtractSlots, type AvailabilityRule, type FreeSlot } from '@/lib/schedule'
import { PART_RANGES, type SlotPart } from '@/lib/schedule/rhythm'

/** Sprint 17: edit the weekly template; date overrides and exceptions are separate inputs. */
export function editWeeklySlots(
  rules: AvailabilityRule[],
  action: { kind: 'avoid_slot' | 'add_slot'; weekend: boolean; part: SlotPart },
): AvailabilityRule[] {
  const range = PART_RANGES[action.part]
  const affected = (weekday: number) => weekday >= 5 === action.weekend
  if (action.kind === 'avoid_slot')
    return rules.flatMap((r) =>
      !affected(r.weekday) ? [r] : subtractSlots([r], [range]).map((slot) => ({ ...r, ...slot })),
    )
  const out = [...rules]
  for (let weekday = 0; weekday < 7; weekday++) {
    if (!affected(weekday)) continue
    const existing = rules.filter((r) => r.weekday === weekday)
    const added: FreeSlot[] = subtractSlots([range], existing)
    out.push(...added.map((slot) => ({ ...slot, weekday, overClasses: false })))
  }
  return out
}

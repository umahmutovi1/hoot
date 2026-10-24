import { usePlanStore } from '@/features/plan/store'
import { pickFor } from './pick'
import type { PlanToday } from './usePlanToday'

/** The "Imaš X min više danas" offer for today, when there is work for the gained time. */
export function useGainedCard(plan: PlanToday) {
  const extra = usePlanStore((s) => s.extraToday)
  const pick = extra && extra.date === plan.today ? pickFor(plan, extra.minutes) : null
  return extra && pick ? { minutes: extra.minutes, pick } : null
}

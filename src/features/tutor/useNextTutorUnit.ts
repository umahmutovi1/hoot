import { isOpen } from '@/features/plan/model'
import { usePlanToday } from '@/features/today/usePlanToday'

/**
 * The chapter the tutor opens on from the AI tab ("Uči sa tutorom"): the first chapter of the
 * next open reading block, today or later. Null without a planned chapter.
 */
export function useNextTutorUnit(): { id: string; title: string } | null {
  const plan = usePlanToday()
  const next = plan.blocks
    .filter((b) => isOpen(b) && b.on_date >= plan.today && b.kind === 'learn')
    .sort((a, b) => a.on_date.localeCompare(b.on_date) || (a.start_min ?? 0) - (b.start_min ?? 0))
    .flatMap((b) => b.plan_block_units)
    .map((u) => plan.units.get(u.unit_id)?.unit)
    .find((u) => u?.kind === 'chapter')
  return next ? { id: next.id, title: [next.label, next.title].filter(Boolean).join(' ') } : null
}

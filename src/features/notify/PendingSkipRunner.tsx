import { useEffect, useRef } from 'react'
import { useClearSkipRequest, useSkipBlock } from '@/features/plan/actions'
import { usePlanBlocks } from '@/features/plan/api'
import { useUnitIndex } from '@/features/plan/model'
import { usePlanStore } from '@/features/plan/store'
import { useDayBoundary } from '@/features/settings/profile'
import { localDay } from '@/lib/day'

/**
 * "Preskoči" from a notification (Stage 10c): push-action only records `skip_requested_at`; once
 * the app is open and the plan is built, today's block is skipped with the same rule as the button
 * (`skipBlock()`, with its toast and undo). A request for a day that has passed is just cleared.
 */
export function PendingSkipRunner() {
  const boundary = useDayBoundary()
  const { data: blocks } = usePlanBlocks(boundary)
  const units = useUnitIndex()
  const ready = usePlanStore((s) => Boolean(s.model))
  const skip = useSkipBlock()
  const clear = useClearSkipRequest()
  const done = useRef(new Set<string>())

  useEffect(() => {
    if (!blocks || !ready) return
    const today = localDay(new Date(), boundary)
    for (const b of blocks) {
      if (!b.skip_requested_at || done.current.has(b.id)) continue
      done.current.add(b.id)
      if (b.status === 'planned' && b.on_date === today) void skip(b, units, false)
      else void clear(b.id)
    }
  }, [blocks, ready, boundary, units, skip, clear])

  return null
}

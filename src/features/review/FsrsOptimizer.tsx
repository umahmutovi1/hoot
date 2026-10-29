import { useEffect, useRef } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { useOnline } from '@/features/owl/api'
import { useDayBoundary, useProfile, useUpdateProfile } from '@/features/settings/profile'
import { localDay } from '@/lib/day'
import {
  fitOf,
  needsFit,
  parseFit,
  trainSequences,
  type OptimizerResult,
  type ReviewLog,
  type TrainReview,
} from '@/lib/srs/optimize'
import { supabase } from '@/lib/supabase'

const PAGE = 1000
const TIMEOUT_MS = 60_000

function optimize(sequences: TrainReview[][]): Promise<OptimizerResult | null> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./fsrs.worker.ts', import.meta.url), { type: 'module' })
    const done = (result: OptimizerResult | null) => {
      clearTimeout(timer)
      worker.terminate()
      resolve(result)
    }
    const timer = setTimeout(() => done(null), TIMEOUT_MS)
    worker.onmessage = (e: MessageEvent<{ result?: OptimizerResult; error?: string }>) => {
      if (e.data.error) console.error('fsrs optimizer failed', e.data.error)
      done(e.data.result ?? null)
    }
    worker.onerror = (e) => {
      console.error('fsrs optimizer failed', e.message)
      done(null)
    }
    worker.postMessage(sequences)
  })
}

async function reviewLogs(): Promise<ReviewLog[]> {
  const out: ReviewLog[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('review_logs')
      .select('id, unit_id, card_id, reviewed_at, recall, rating')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data)
      out.push({
        itemId: r.card_id ?? `unit:${r.unit_id}`,
        reviewedAt: r.reviewed_at,
        recall: r.recall as ReviewLog['recall'],
        rating: r.rating,
      })
    if (data.length < PAGE) return out
  }
}

/**
 * Personal FSRS parameters (ROADMAP 11a): once there are enough reviews, and again as they grow,
 * fits the weights in a worker and stores the result in `profiles.fsrs_params`. Once per app
 * start, online only; a failed fit is stored too (without weights), so it is not retried on
 * every start.
 */
export function FsrsOptimizer() {
  const userId = useAuth().session?.user.id
  const online = useOnline()
  const profile = useProfile().data
  const boundary = useDayBoundary()
  const update = useUpdateProfile()
  const ran = useRef(false)
  const save = update.mutate

  useEffect(() => {
    if (!userId || !online || !profile || ran.current) return
    ran.current = true
    const run = async () => {
      const today = localDay(new Date(), boundary)
      const { count, error } = await supabase
        .from('review_logs')
        .select('id', { count: 'exact', head: true })
      if (error || count === null) return
      if (!needsFit(parseFit(profile.fsrs_params), count, today)) return
      const sequences = trainSequences(await reviewLogs(), boundary)
      const result = await optimize(sequences)
      save({ fsrs_params: { ...fitOf(result, count, today) } })
    }
    run().catch((e) => console.error('fsrs optimizer failed', e))
  }, [userId, online, profile, boundary, save])

  return null
}

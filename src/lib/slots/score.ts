import { addDays, startOfWeek, type LocalDate } from '@/lib/day'
import { hashString, seededRandom } from '@/lib/scheduler/hash'
import type { ExploreDay, SlotCompletion } from '@/lib/scheduler/types'
import { SLOT_PARTS, type SlotPart } from '@/lib/schedule/rhythm'
import {
  COMPLETION_PRIORS,
  completionProbability,
  logitOf,
  sampleFixed,
  sigmoid,
  type CompletionPosterior,
} from './completion'

/**
 * Scheduler inputs from the completion model: the expected done share of a plain learning block
 * per part of the day (capacity per slot and slot scores), and the weekly exploring day with its
 * posterior draw (Thompson). Rounded, so tiny posterior moves do not change `input_hash`.
 */

const round3 = (x: number) => Math.round(x * 1000) / 1000

const plainBlock = (part: SlotPart, weekend: boolean) => ({
  part,
  weekend,
  kind: 'learn' as const,
  demand: 1,
  dayLoadMin: COMPLETION_PRIORS.loadFreeMin,
  daysToGoal: null,
  prevLate: false,
})

type Rule = (post: CompletionPosterior, part: SlotPart, weekend: boolean) => number

const expected: Rule = (post, part, weekend) =>
  completionProbability(post, plainBlock(part, weekend))

/**
 * Score of a slot for placing work: one posterior sd below the mean (logit). A part of the day
 * that was never planned keeps the prior's spread, so it does not beat measured parts on prior
 * optimism alone; trying it is the exploring block's job.
 */
const cautious: Rule = (post, part, weekend) => {
  const { mean, variance } = logitOf(post, plainBlock(part, weekend))
  return sigmoid(mean - Math.sqrt(variance))
}

function table(post: CompletionPosterior, weekend: boolean, rule: Rule) {
  return Object.fromEntries(
    SLOT_PARTS.map((part) => [part, round3(rule(post, part, weekend))]),
  ) as Record<SlotPart, number>
}

/** Expected done share per part of the day (capacity). */
export function slotCompletion(post: CompletionPosterior): SlotCompletion {
  return { weekday: table(post, false, expected), weekend: table(post, true, expected) }
}

/** Cautious slot scores (where work goes). */
export function slotScores(post: CompletionPosterior): SlotCompletion {
  return { weekday: table(post, false, cautious), weekend: table(post, true, cautious) }
}

/** Standard normal numbers from a seeded uniform source (Box–Muller). */
export function normalFrom(random: () => number): () => number {
  return () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
}

/**
 * One exploring day per week from `from` to `to`: the weekday comes from the week and `seed`
 * (stable across replans, so a week never gets a second exploring block), the draw from the
 * current posterior.
 */
export function exploreDays(
  post: CompletionPosterior,
  from: LocalDate,
  to: LocalDate,
  seed: string,
): ExploreDay[] {
  const out: ExploreDay[] = []
  for (let week = startOfWeek(from); week <= to; week = addDays(week, 7)) {
    const random = seededRandom(Number.parseInt(hashString(`${seed}:${week}`).slice(0, 8), 16))
    const date = addDays(week, Math.floor(random() * 7))
    if (date < from || date > to) continue
    const draw = slotCompletion(sampleFixed(post, normalFrom(random)))
    out.push({ date, scores: draw[date >= addDays(week, 5) ? 'weekend' : 'weekday'] })
  }
  return out
}

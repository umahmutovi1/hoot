import { default_w } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import type { Row } from '@/lib/sync'
import { planReviews, readCheckOn, type ReviewContext } from './apply'
import { reviewLimits } from './limits'
import { memoryColumns } from './memory'
import { card, unit } from './fixtures'
import { exam, state, subject, units } from '@/lib/scheduler/fixtures'

const boundary = { timeZone: 'Europe/Sarajevo', dayStartMin: 240 }
const TODAY = '2026-10-22'
const AT = '2026-10-22T10:00:00.000Z'

const ctx = (limits: ReviewContext['limits'] = new Map()): ReviewContext => ({
  today: TODAY,
  at: AT,
  boundary,
  limits,
})

const patchOf = (plan: ReturnType<typeof planReviews>, table: string, id: string) =>
  plan.ops.find((o) => o.kind === 'update' && o.table === table && o.match.id === id) as
    { patch: Row } | undefined
const logsOf = (plan: ReturnType<typeof planReviews>) =>
  (plan.ops.find((o) => o.kind === 'upsert' && o.table === 'review_logs') as { rows: Row[] }).rows

describe('planReviews', () => {
  it('uses the personal FSRS weights when the profile has them', () => {
    const input = [{ unit: unit('a'), recalls: [{ recall: 2 as const, source: 'notes' as const }] }]
    const fallback = planReviews(input, [], ctx())
    // A lower first stability for "Good" (w[2]): weaker memory tomorrow.
    const w = [...default_w]
    w[2] = 0.5
    const personal = planReviews(input, [], { ...ctx(), params: w })
    expect(patchOf(personal, 'units', 'a')!.patch.fsrs_stability).toBeLessThan(
      patchOf(fallback, 'units', 'a')!.patch.fsrs_stability as number,
    )
    expect(personal.outcomes[0]!.strengthAfter).toBeLessThan(fallback.outcomes[0]!.strengthAfter)
  })

  it('"Sjećam se" in the gate: level 2, memory, next review and a log', () => {
    const plan = planReviews(
      [
        {
          unit: unit('a'),
          recalls: [
            { recall: 2, source: 'notes' },
            { recall: 2, source: 'outline' },
          ],
        },
      ],
      [],
      ctx(),
    )
    const patch = patchOf(plan, 'units', 'a')!.patch
    expect(patch.level).toBe(2)
    expect(patch.completed_at).toBe(AT)
    expect(patch.fsrs_reps).toBe(1)
    expect(patch.review_streak).toBe(1)
    expect(patch.last_review_at).toBe(AT)
    expect(patch.next_review_on! > TODAY).toBe(true)
    const [log] = logsOf(plan)
    expect(log).toMatchObject({
      unit_id: 'a',
      card_id: null,
      source: 'outline',
      recall: 2,
      was_scheduled: false,
      elapsed_days: 0,
      stability_before: null,
      rating: 3,
      state_before: null,
      difficulty_before: null,
      retrievability_before: null,
    })
    expect(plan.outcomes[0]).toMatchObject({ levelBefore: 1, levelAfter: 2, relearn: false })
  })

  it('general knowledge alone does not make a chapter "Razumijem"; with another test it does', () => {
    const alone = planReviews(
      [{ unit: unit('a'), recalls: [{ recall: 2, source: 'general' }] }],
      [],
      ctx(),
    )
    expect(patchOf(alone, 'units', 'a')!.patch.level).toBeUndefined()
    expect(patchOf(alone, 'units', 'a')!.patch.fsrs_reps).toBe(1)
    expect(logsOf(alone)[0]).toMatchObject({ source: 'general', recall: 2 })
    const both = planReviews(
      [
        {
          unit: unit('a'),
          recalls: [
            { recall: 2, source: 'general' },
            { recall: 2, source: 'page_photo' },
          ],
        },
      ],
      [],
      ctx(),
    )
    expect(patchOf(both, 'units', 'a')!.patch.level).toBe(2)
    expect(logsOf(both)[0]).toMatchObject({ source: 'page_photo' })
  })

  it('a failed check of a known chapter sends it back to learning', () => {
    const known = unit('a', {
      level: 2,
      next_review_on: TODAY,
      ...memoryColumns(
        {
          stability: 8,
          difficulty: 5,
          state: 2,
          reps: 2,
          lapses: 0,
          lastReviewOn: '2026-10-12',
          streak: 2,
        },
        '2026-10-12T10:00:00Z',
      ),
    })
    const plan = planReviews(
      [{ unit: known, recalls: [{ recall: 0, source: 'exam_question' }] }],
      [],
      ctx(),
    )
    const patch = patchOf(plan, 'units', 'a')!.patch
    expect(patch.level).toBe(1)
    expect(patch.next_review_on).toBeNull()
    expect(patch.review_streak).toBe(0)
    const [log] = logsOf(plan)
    expect(log).toMatchObject({ was_scheduled: true, elapsed_days: 10, interval_before: 10 })
    expect(log!.stability_before).toBe(8)
    // "Ne" is FSRS Again; the state, difficulty and strength just before the review.
    expect(log).toMatchObject({ rating: 1, state_before: 2, difficulty_before: 5 })
    expect(log!.retrievability_before).toBeCloseTo(plan.outcomes[0]!.strengthBefore!, 4)
    expect(plan.outcomes[0]!.relearn).toBe(true)
    expect(plan.outcomes[0]!.strengthBefore).toBeLessThan(0.9)
  })

  it('a failed check of what was read keeps "Pročitano"', () => {
    const plan = planReviews(
      [{ unit: unit('a'), recalls: [{ recall: 0, source: 'blurt' }] }],
      [],
      ctx(),
    )
    expect(patchOf(plan, 'units', 'a')!.patch.level).toBeUndefined()
    expect(patchOf(plan, 'units', 'a')!.patch.next_review_on).toBeNull()
  })

  it('"Ponovljeno" after 4 successes in a row', () => {
    const a = unit('a', {
      level: 2,
      next_review_on: TODAY,
      ...memoryColumns(
        {
          stability: 20,
          difficulty: 5,
          state: 2,
          reps: 3,
          lapses: 0,
          lastReviewOn: '2026-10-02',
          streak: 3,
        },
        '2026-10-02T10:00:00Z',
      ),
    })
    const plan = planReviews([{ unit: a, recalls: [{ recall: 2, source: 'notes' }] }], [], ctx())
    expect(patchOf(plan, 'units', 'a')!.patch.level).toBe(3)
  })

  it('questions become "Znam" and keep their next review on a miss', () => {
    const q = unit('q', { kind: 'question', level: 0 })
    const ok = planReviews(
      [{ unit: q, recalls: [{ recall: 2, source: 'exam_question' }] }],
      [],
      ctx(),
    )
    expect(patchOf(ok, 'units', 'q')!.patch.level).toBe(3)
    const miss = planReviews(
      [{ unit: q, recalls: [{ recall: 0, source: 'exam_question' }] }],
      [],
      ctx(),
    )
    expect(patchOf(miss, 'units', 'q')!.patch.next_review_on).not.toBeNull()
  })

  it('cards get their own memory and log with card_id', () => {
    const plan = planReviews([], [{ card: card('c', 'a'), unit: unit('a'), recall: 1 }], ctx())
    const patch = patchOf(plan, 'cards', 'c')!.patch
    expect(patch.fsrs_reps).toBe(1)
    expect(patch.next_review_on! > TODAY).toBe(true)
    expect(logsOf(plan)[0]).toMatchObject({ unit_id: 'a', card_id: 'c', source: 'card', recall: 1 })
    expect(patchOf(plan, 'units', 'a')).toBeUndefined()
  })

  it('never schedules past the last day before the exam', () => {
    const u = units('s1', 1, 60)
    const s = state({
      subjects: [subject('s1', { priority: 5 })],
      units: u,
      goals: [exam('e', 's1', '2026-10-27', [u[0]!.id])],
    })
    const limits = reviewLimits({ ...s, from: TODAY }, TODAY)
    // priority 5 → 2 buffer days → first buffer day 25 Oct
    expect(limits.get(u[0]!.id)).toEqual({ priority: 5, lastDay: '2026-10-25' })
    const plan = planReviews(
      [{ unit: unit(u[0]!.id, { level: 2 }), recalls: [{ recall: 2, source: 'notes' }] }],
      [],
      ctx(limits),
    )
    expect(plan.outcomes[0]!.nextReviewOn! <= '2026-10-25').toBe(true)
  })
})

describe('readCheckOn', () => {
  it('2 days after reading, unless an earlier check is planned', () => {
    expect(readCheckOn(TODAY, null)).toBe('2026-10-24')
    expect(readCheckOn(TODAY, '2026-10-30')).toBe('2026-10-24')
    expect(readCheckOn(TODAY, '2026-10-23')).toBe('2026-10-23')
  })
})

import { describe, expect, it } from 'vitest'
import { addDays, startOfWeek } from '@/lib/day'
import { SLOT_GAP } from '@/lib/scheduler/constants'
import { fitCompletion, type CompletionExample } from './completion'
import { exploreDays, slotCompletion, slotScores } from './score'

const TODAY = '2026-12-01'

const evenings = (label: CompletionExample['label'], n: number): CompletionExample[] =>
  Array.from({ length: n }, (_, i) => ({
    subjectId: 'a',
    onDate: addDays(TODAY, -1 - (i % 20)),
    label,
    part: 'evening',
    weekend: false,
    kind: 'learn',
    demand: 1,
    dayLoadMin: 120,
    daysToGoal: null,
    prevLate: false,
  }))

describe('slotCompletion / slotScores', () => {
  it('measured parts move; the cautious score sits below the expected share', () => {
    const post = fitCompletion([...evenings('done', 10), ...evenings('skipped', 30)], TODAY)
    const expected = slotCompletion(post)
    const scores = slotScores(post)
    expect(expected.weekday.evening).toBeLessThan(expected.weekday.afternoon)
    for (const part of ['morning', 'evening'] as const)
      expect(scores.weekday[part]).toBeLessThan(expected.weekday[part])
  })

  it('without data the onboarding parts still win clearly (more than SLOT_GAP)', () => {
    const scores = slotScores(fitCompletion([], TODAY, ['evening'])).weekday
    expect(scores.evening - scores.afternoon).toBeGreaterThan(SLOT_GAP)
  })

  it('an unmeasured part does not beat a measured one on prior optimism', () => {
    // Evenings go as well as the prior expects; mornings were never planned.
    const post = fitCompletion([...evenings('done', 32), ...evenings('skipped', 8)], TODAY)
    const scores = slotScores(post).weekday
    expect(scores.morning).toBeLessThan(scores.evening)
  })
})

describe('exploreDays', () => {
  const post = fitCompletion(evenings('done', 10), TODAY)

  it('at most one day a week, stable across replans of the same week', () => {
    const days = exploreDays(post, TODAY, addDays(TODAY, 60), 'user')
    const weeks = days.map((d) => startOfWeek(d.date))
    expect(new Set(weeks).size).toBe(weeks.length)
    // Replanning two days later keeps the week's day (when it is still ahead).
    const later = exploreDays(post, addDays(TODAY, 2), addDays(TODAY, 60), 'user')
    for (const d of later) {
      const same = days.find((x) => startOfWeek(x.date) === startOfWeek(d.date))
      if (same) expect(d.date).toBe(same.date)
    }
  })

  it('another seed picks other days', () => {
    const a = exploreDays(post, TODAY, addDays(TODAY, 120), 'a').map((d) => d.date)
    const b = exploreDays(post, TODAY, addDays(TODAY, 120), 'b').map((d) => d.date)
    expect(a).not.toEqual(b)
  })
})

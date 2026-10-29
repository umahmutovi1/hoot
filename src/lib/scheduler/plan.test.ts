import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { BUILT_IN_PRESETS, breaksWithin } from '@/lib/session/timer'
import { aiCapacity, coverageOf, inputHash, plan, remainingWork, type PlanState } from '.'
import { dayRealization } from './plan'
import { dayTotal, days, exam, FROM, minutesBy, state, subject, units } from './fixtures'

const day = (n: number) => addDays(FROM, n)

function oneSubject(over: Partial<PlanState> = {}, count = 6, minutes = 60, examIn = 10) {
  const u = units('a', count, minutes)
  return state({
    subjects: [subject('a')],
    units: u,
    goals: [
      exam(
        'ea',
        'a',
        day(examIn),
        u.map((x) => x.id),
      ),
    ],
    ...over,
  })
}

describe('plan: partial reading', () => {
  it('a partly read unit only needs the rest, and its pages start after the read ones', () => {
    const s = oneSubject({}, 1, 60)
    const page = { ...s.units[0]!, pageStart: 1, pageEnd: 9 }
    const full = remainingWork({ ...s, units: [page] })[0]!.minutes
    const half = { ...s, units: [{ ...page, readShare: 2 / 9 }] }
    expect(remainingWork(half)[0]!.minutes).toBe(Math.round(full * (7 / 9)))
    const block = plan(half).blocks.find((b) => b.units.length > 0)!
    expect(block.units[0]!.pageFrom).toBe(3)
    // A read unit (level 1) ignores the share.
    const read = { ...s, units: [{ ...page, level: 1, readShare: 0.5 }] }
    expect(remainingWork(read)[0]!.minutes).toBe(
      remainingWork({ ...s, units: [{ ...page, level: 1 }] })[0]!.minutes,
    )
  })
})

describe('plan: capacity', () => {
  it('plans nothing without free time and reports the whole work as deficit', () => {
    const s = oneSubject({ days: days(28, []) })
    const r = plan(s)
    expect(r.blocks).toEqual([])
    expect(r.deficits).toEqual([
      expect.objectContaining({ goalId: 'ea', minutes: expect.any(Number) }),
    ])
    expect(r.deficits[0]!.minutes).toBeGreaterThan(300)
  })

  it('plans min(free, cap) × ρ × 0.9 at most', () => {
    const s = oneSubject({ rho: 0.8 }, 20, 60, 20)
    const r = plan(s)
    const cap = Math.floor(240 * 0.8 * 0.9)
    expect(aiCapacity(s)[0]).toBe(cap)
    for (let i = 0; i < 20; i++) expect(dayTotal(r.blocks, day(i))).toBeLessThanOrEqual(cap)
    expect(dayTotal(r.blocks, day(0))).toBeGreaterThan(0)
  })

  it('capacity per slot: ρ keeps the level, the completion model shapes it per day', () => {
    const flat = { morning: 0.8, midday: 0.8, afternoon: 0.8, evening: 0.8, night: 0.8 }
    // Weekends go worse; the mean over the horizon stays ρ.
    const s = state({
      rho: 0.8,
      slotCompletion: {
        weekday: flat,
        weekend: { ...flat, morning: 0.5, midday: 0.5, afternoon: 0.5, evening: 0.5 },
      },
    })
    const share = dayRealization(s)
    const mean = share.reduce((a, b) => a + b, 0) / share.length
    expect(mean).toBeCloseTo(0.8, 2)
    expect(share[5]).toBeLessThan(share[0]!) // Saturday vs Monday
    expect(aiCapacity(s)[0]).toBeGreaterThan(aiCapacity(state({ rho: 0.8 }))[0]!)
    // Without the model (or with equal slots) it is ρ for every day.
    expect(dayRealization(state({ rho: 0.8 }))).toEqual(s.days.map(() => 0.8))
    const even = dayRealization(
      state({ rho: 0.7, slotCompletion: { weekday: flat, weekend: flat } }),
    )
    for (const x of even) expect(x).toBeCloseTo(0.7, 10)
  })

  it('subtracts classes and calendar busy time (net free slots) from the day', () => {
    // 09–12 free only: busy afternoon from a connected calendar is already cut out.
    const s = oneSubject({ days: days(28, [{ startMin: 9 * 60, endMin: 12 * 60 }]) }, 20, 60, 20)
    const r = plan(s)
    const first = r.blocks.filter((b) => b.onDate === day(0))
    expect(dayTotal(first, day(0))).toBeLessThanOrEqual(Math.floor(180 * 0.9))
    for (const b of first) {
      expect(b.startMin!).toBeGreaterThanOrEqual(9 * 60)
      expect(b.startMin! + b.minutes).toBeLessThanOrEqual(12 * 60)
    }
  })

  it('a manual block consumes the capacity of its day', () => {
    const base = oneSubject({}, 20, 60, 20)
    const s = {
      ...base,
      fixed: [
        {
          id: 'm1',
          subjectId: 'a',
          goalId: null,
          onDate: day(0),
          startMin: 600,
          minutes: 100,
          kind: 'learn' as const,
          origin: 'user' as const,
          units: [],
        },
      ],
    }
    const r = plan(s)
    expect(dayTotal(r.blocks, day(0))).toBeLessThanOrEqual(Math.floor(240 * 0.9) - 100)
  })
})

describe('plan: goals', () => {
  it('two exams on the same day share the days by urgency', () => {
    const a = units('a', 6, 60)
    const b = units('b', 6, 60)
    const s = state({
      subjects: [subject('a'), subject('b')],
      units: [...a, ...b],
      goals: [
        exam(
          'ea',
          'a',
          day(10),
          a.map((u) => u.id),
        ),
        exam(
          'eb',
          'b',
          day(10),
          b.map((u) => u.id),
        ),
      ],
    })
    const r = plan(s)
    const by = minutesBy(r.blocks)
    expect(by.get(`${day(0)}|a`)).toBeGreaterThan(0)
    expect(by.get(`${day(0)}|b`)).toBeGreaterThan(0)
    expect(r.deficits).toEqual([])
  })

  it('reports a deficit when the work does not fit before the exam', () => {
    const s = oneSubject({}, 20, 60, 3)
    const r = plan(s)
    expect(r.deficits).toHaveLength(1)
    // 2 learning days (exam on day 3, buffer 1) of 216 min, 90% of 1200 min required.
    expect(r.deficits[0]!.minutes).toBe(Math.round(0.9 * 1200) - 2 * 200)
    expect(r.deficits[0]!.lastDay).toBe(day(1))
  })

  it('keeps the buffer days for review and questions only', () => {
    const u = units('a', 4, 60, { level: 1 })
    const fresh = units('b', 4, 60).map((x) => ({ ...x, subjectId: 'a' }))
    const s = state({
      subjects: [subject('a')],
      units: [...u, ...fresh],
      goals: [
        exam(
          'ea',
          'a',
          day(5),
          [...u, ...fresh].map((x) => x.id),
        ),
      ],
      settings: { ...state().settings, bufferDays: 2 },
    })
    const r = plan(s)
    const buffer = r.blocks.filter((b) => b.onDate >= day(3))
    expect(buffer.length).toBeGreaterThan(0)
    for (const b of buffer) {
      expect(['review', 'questions']).toContain(b.kind)
      expect(b.reason.code).toBe('buffer')
    }
    expect(r.blocks.some((b) => b.kind === 'learn' && b.onDate >= day(3))).toBe(false)
  })

  it('priority 5 gets one more buffer day', () => {
    const u = units('a', 4, 60, { level: 1 })
    const s = state({
      subjects: [subject('a', { priority: 5 })],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(6),
          u.map((x) => x.id),
        ),
      ],
    })
    const r = plan(s)
    expect(r.blocks.filter((b) => b.reason.code === 'buffer').map((b) => b.onDate)).toEqual([
      day(4),
      day(5),
    ])
  })

  it('several exams of one subject: the first partial goes first, the second waits its turn', () => {
    const first = units('a', 4, 60)
    const second = units('a', 4, 60).map((x, i) => ({ ...x, id: `a-v${i}`, order: 10 + i }))
    const s = state({
      subjects: [subject('a')],
      units: [...first, ...second],
      goals: [
        exam(
          'e1',
          'a',
          day(6),
          first.map((x) => x.id),
        ),
        exam(
          'e2',
          'a',
          day(20),
          second.map((x) => x.id),
        ),
        // The final covers everything, but units belong to the earliest exam.
        exam(
          'fin',
          'a',
          day(25),
          [...first, ...second].map((x) => x.id),
        ),
      ],
    })
    const r = plan(s)
    const firstDay = r.blocks.filter((b) => b.onDate === day(0) && b.kind === 'learn')
    expect(firstDay[0]!.goalId).toBe('e1')
    expect(r.blocks.some((b) => b.goalId === 'fin')).toBe(false)
    const lastE1 = r.blocks.filter((b) => b.goalId === 'e1' && b.kind === 'learn').at(-1)!
    const firstE2 = r.blocks.find((b) => b.goalId === 'e2')!
    expect(firstE2.onDate >= lastE1.onDate).toBe(true)
  })

  it('plans a deadline as deadline blocks before its due date', () => {
    const s = state({
      subjects: [subject('a')],
      goals: [
        { id: 'd1', subjectId: 'a', kind: 'deadline', on: day(3), unitIds: [], minutes: 120 },
      ],
    })
    const r = plan(s)
    expect(r.blocks.every((b) => b.kind === 'deadline' && b.onDate < day(3))).toBe(true)
    expect(r.blocks.reduce((sum, b) => sum + b.minutes, 0)).toBe(120)
  })
})

describe('plan: priority and coverage', () => {
  it('weights urgency by priority when subjects compete', () => {
    const a = units('a', 20, 60)
    const b = units('b', 20, 60)
    const s = state({
      subjects: [subject('a', { priority: 1 }), subject('b', { priority: 5 })],
      units: [...a, ...b],
      goals: [
        exam(
          'ea',
          'a',
          day(12),
          a.map((u) => u.id),
        ),
        exam(
          'eb',
          'b',
          day(12),
          b.map((u) => u.id),
        ),
      ],
    })
    const r = plan(s)
    const by = minutesBy(r.blocks)
    expect(by.get(`${day(0)}|b`)!).toBeGreaterThan(by.get(`${day(0)}|a`) ?? 0)
  })

  it('a boost raises the subject’s share until it ends', () => {
    const a = units('a', 20, 60)
    const b = units('b', 20, 60)
    const base = state({
      subjects: [subject('a'), subject('b')],
      units: [...a, ...b],
      goals: [
        exam(
          'ea',
          'a',
          day(20),
          a.map((u) => u.id),
        ),
        exam(
          'eb',
          'b',
          day(20),
          b.map((u) => u.id),
        ),
      ],
    })
    const boosted = {
      ...base,
      subjects: [subject('a', { boostUntil: day(5) }), subject('b')],
    }
    const before = minutesBy(plan(base).blocks)
    const after = minutesBy(plan(boosted).blocks)
    expect(after.get(`${day(0)}|a`)!).toBeGreaterThan(before.get(`${day(0)}|a`)!)
    expect(plan(boosted).blocks.find((b) => b.subjectId === 'a')!.reason.boost).toBe(true)
  })

  it('required coverage follows priority; the rest is optional and never a deficit', () => {
    expect(coverageOf(subject('a', { priority: 1 }))).toBe(0.7)
    expect(coverageOf(subject('a', { priority: 5 }))).toBe(1)
    const s = oneSubject({}, 10, 60, 3)
    s.subjects = [subject('a', { priority: 1 })]
    const r = plan(s)
    // 70% of 600 min required, 2 days × 200 planned.
    expect(r.deficits[0]!.minutes).toBe(420 - 400)
  })

  it('target grade raises coverage to the needed share + 10 p.p.', () => {
    expect(coverageOf(subject('a', { priority: 1, requiredShare: 0.85 }))).toBeCloseTo(0.95)
    expect(coverageOf(subject('a', { priority: 4, requiredShare: 0.5 }))).toBe(0.95)
    expect(coverageOf(subject('a', { requiredShare: 0.97 }))).toBe(1)
  })

  it('optional work only fills capacity left over by required work', () => {
    const s = oneSubject({}, 10, 60, 20)
    const r = plan(s)
    const optional = r.blocks.filter((b) => b.units.some((u) => u.unitId === 'a-u10'))
    const required = r.blocks.filter((b) => b.units.some((u) => u.unitId === 'a-u09'))
    expect(optional[0]!.onDate >= required.at(-1)!.onDate).toBe(true)
  })

  it('caps the number of subjects per day', () => {
    const subjects = ['a', 'b', 'c', 'd', 'e'].map((id) => subject(id))
    const all = subjects.flatMap((x) => units(x.id, 8, 60))
    const s = state({
      subjects,
      units: all,
      goals: subjects.map((x) =>
        exam(
          `e${x.id}`,
          x.id,
          day(10),
          all.filter((u) => u.subjectId === x.id).map((u) => u.id),
        ),
      ),
      days: days(28, [{ startMin: 8 * 60, endMin: 22 * 60 }], 600),
    })
    const r = plan(s)
    for (let i = 0; i < 9; i++) {
      const ids = new Set(r.blocks.filter((b) => b.onDate === day(i)).map((b) => b.subjectId))
      expect(ids.size).toBeLessThanOrEqual(3)
    }
  })
})

describe('plan: campaigns', () => {
  const campaign = (over: Parameters<typeof subject>[1] = {}) => {
    const u = units('c', 8, 60)
    return state({
      subjects: [subject('c', { mode: 'campaign', ...over })],
      units: u,
      goals: [
        exam(
          'ec',
          'c',
          day(25),
          u.map((x) => x.id),
        ),
      ],
    })
  }

  it('starts ALAP before the exam plus a margin of 20% (at least 2 days)', () => {
    const r = plan(campaign())
    const start = r.campaignStarts.c!
    // 8 × 60 × 90% = 432 min at 200 per day ≈ 3 days back from day 23 (buffer 1), + 2 days.
    expect(start).toBe(day(19))
    expect(r.computedStarts.c).toBe(start)
    expect(r.blocks.every((b) => b.onDate >= start)).toBe(true)
    expect(r.blocks.find((b) => b.onDate === start)!.reason.code).toBe('campaign_start')
    expect(r.deficits).toEqual([])
  })

  it('a lower ρ moves the start earlier', () => {
    const slow = { ...campaign(), rho: 0.5 }
    expect(plan(slow).campaignStarts.c! < plan(campaign()).campaignStarts.c!).toBe(true)
  })

  it('a manual start wins and is not changed by replan', () => {
    const r = plan(campaign({ campaignStartOn: day(5) }))
    expect(r.campaignStarts.c).toBe(day(5))
    expect(r.computedStarts.c).toBe(day(19))
    expect(r.blocks[0]!.onDate).toBe(day(5))
  })

  it('a manual start too late makes a deficit and keeps the computed day for "Kreni ranije"', () => {
    const r = plan(campaign({ campaignStartOn: day(23) }))
    expect(r.deficits).toHaveLength(1)
    expect(r.computedStarts.c).toBe(day(19))
  })

  it('"Počni odmah" (manual start today) plans from today', () => {
    const r = plan(campaign({ campaignStartOn: FROM }))
    expect(r.blocks[0]!.onDate).toBe(FROM)
  })

  it('two campaigns in the same week: the later exam starts earlier than alone', () => {
    const c = units('c', 8, 60)
    const d = units('d', 8, 60)
    const both = state({
      subjects: [subject('c', { mode: 'campaign' }), subject('d', { mode: 'campaign' })],
      units: [...c, ...d],
      goals: [
        exam(
          'ec',
          'c',
          day(24),
          c.map((x) => x.id),
        ),
        exam(
          'ed',
          'd',
          day(25),
          d.map((x) => x.id),
        ),
      ],
    })
    const alone = state({
      subjects: [subject('d', { mode: 'campaign' })],
      units: d,
      goals: [
        exam(
          'ed',
          'd',
          day(25),
          d.map((x) => x.id),
        ),
      ],
    })
    const r = plan(both)
    expect(r.campaignStarts.d! < plan(alone).campaignStarts.d!).toBe(true)
    expect(r.deficits).toEqual([])
  })

  it('reviews a campaign subject before its start', () => {
    const s = campaign()
    s.units = s.units.map((u, i) => (i === 0 ? { ...u, level: 2, nextReviewOn: day(2) } : u))
    const r = plan(s)
    const review = r.blocks.find((b) => b.kind === 'review')!
    expect(review.onDate).toBe(day(2))
    expect(review.onDate < r.campaignStarts.c!).toBe(true)
  })
})

describe('plan: lectures', () => {
  it('units covered in class get a soft deadline and go first', () => {
    const u = units('a', 10, 60, { tracked: true }).map((x, i) =>
      i >= 6 && i < 8 ? { ...x, coveredOn: day(0) } : x,
    )
    const s = state({
      subjects: [subject('a')],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(25),
          u.map((x) => x.id),
        ),
      ],
    })
    const r = plan(s)
    const first = r.blocks[0]!
    expect(first.units[0]!.unitId).toBe('a-u07')
    expect(first.reason).toMatchObject({ code: 'lecture', date: day(0) })
  })

  it('material not covered in class yet is not pushed ahead (ALAP)', () => {
    const u = units('a', 10, 60, { tracked: true }).map((x, i) =>
      i < 2 ? { ...x, coveredOn: day(0) } : x,
    )
    const s = state({
      subjects: [subject('a')],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(25),
          u.map((x) => x.id),
        ),
      ],
    })
    const r = plan(s)
    const uncovered = r.blocks.filter((b) => b.units.some((x) => x.unitId === 'a-u05'))
    expect(uncovered[0]!.onDate > day(5)).toBe(true)
    expect(r.deficits).toEqual([])
  })

  it('a soft deadline that does not fit never makes a deficit', () => {
    const u = units('a', 10, 120, { tracked: true, coveredOn: day(-6) })
    const s = state({
      subjects: [subject('a')],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(25),
          u.map((x) => x.id),
        ),
      ],
    })
    expect(plan(s).deficits).toEqual([])
  })

  it('adds a 15 min recap on a day with a lecture of the subject', () => {
    const s = oneSubject({ settings: { ...state().settings, recapAfterLecture: true } }, 6, 60, 10)
    s.days = s.days.map((d, i) => (i === 1 ? { ...d, lectureSubjectIds: ['a'] } : d))
    const r = plan(s)
    const recaps = r.blocks.filter((b) => b.kind === 'recap')
    expect(recaps.map((b) => [b.onDate, b.minutes])).toEqual([[day(1), 15]])
  })
})

describe('plan: reviews', () => {
  it('review blocks for units due, before learning, within the review cap', () => {
    const u = units('a', 30, 60).map((x, i) =>
      i < 20 ? { ...x, level: 2, nextReviewOn: day(0) } : x,
    )
    const s = state({
      subjects: [subject('a')],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(20),
          u.map((x) => x.id),
        ),
      ],
    })
    const r = plan(s)
    const reviews = r.blocks.filter((b) => b.kind === 'review' && b.onDate === day(0))
    const reviewMin = reviews.reduce((sum, b) => sum + b.minutes, 0)
    expect(reviewMin).toBeGreaterThan(0)
    expect(reviewMin).toBeLessThanOrEqual(Math.floor(216 * 0.4))
    // the rest moves to the next day, once per unit
    const ids = r.blocks
      .filter((b) => b.kind === 'review')
      .flatMap((b) => b.units.map((x) => x.unitId))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(20)
  })

  it('no reviews for units outside any upcoming exam', () => {
    const u = units('a', 4, 60, { level: 2, nextReviewOn: day(0) })
    const s = state({ subjects: [subject('a')], units: u, goals: [] })
    expect(plan(s).blocks).toEqual([])
  })

  it('a check due after the exam moves to the last day before the buffer', () => {
    const u = units('a', 3, 60, { level: 2 }).map((x, i) =>
      i === 0
        ? { ...x, nextReviewOn: day(30), memory: { stability: 40, lastReviewOn: day(-5) } }
        : x,
    )
    const s = state({
      subjects: [subject('a')],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(10),
          u.map((x) => x.id),
        ),
      ],
    })
    const review = plan(s).blocks.find(
      (b) => b.kind === 'review' && b.units.some((x) => x.unitId === u[0]!.id),
    )
    // exam on day 10, one buffer day → the check falls on day 9
    expect(review?.onDate).toBe(day(9))
  })

  it('without a buffer the clamped check falls the day before the exam', () => {
    const u = units('a', 2, 60, { level: 2, nextReviewOn: day(40) })
    const s = state({
      subjects: [subject('a')],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(6),
          u.map((x) => x.id),
        ),
      ],
      settings: { ...state().settings, bufferDays: 0 },
    })
    const days = plan(s)
      .blocks.filter((b) => b.kind === 'review')
      .map((b) => b.onDate)
    expect(days).toEqual([day(5)])
  })

  it('over the cap the weaker unit goes first', () => {
    const memory = (stability: number) => ({ stability, lastReviewOn: day(-10) })
    const u = [
      ...units('a', 1, 60, { level: 2, nextReviewOn: day(0), memory: memory(60) }),
      ...units('b', 1, 60, { level: 2, nextReviewOn: day(0), memory: memory(3) }).map((x) => ({
        ...x,
        subjectId: 'a',
      })),
    ]
    const s = state({
      subjects: [subject('a')],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(20),
          u.map((x) => x.id),
        ),
      ],
      // one 9 min check fits a day's review share (10% of the capacity)
      settings: { ...state().settings, reviewCapPct: 5 },
      days: days(28, [{ startMin: 9 * 60, endMin: 12 * 60 + 20 }]),
    })
    const first = plan(s).blocks.find((b) => b.kind === 'review' && b.onDate === day(0))
    expect(first?.units.map((x) => x.unitId)).toEqual(['b-u01'])
  })

  it('micro-slots (shorter than the minimum block) take reviews only', () => {
    const u = units('a', 6, 60).map((x, i) =>
      i === 0 ? { ...x, level: 2, nextReviewOn: day(0) } : x,
    )
    const s = state({
      subjects: [subject('a')],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(10),
          u.map((x) => x.id),
        ),
      ],
      days: days(28, [{ startMin: 10 * 60, endMin: 10 * 60 + 30 }]),
      settings: { ...state().settings, minBlockMinutes: 40 },
    })
    const r = plan(s)
    expect(r.blocks.filter((b) => b.onDate === day(0)).map((b) => b.kind)).toEqual(['review'])
    expect(r.blocks.some((b) => b.kind === 'learn')).toBe(false)
  })
})

describe('plan: realization and growth', () => {
  it('ρ scales the planned minutes', () => {
    const full = plan(oneSubject({ rho: 1 }, 20, 60, 20))
    const low = plan(oneSubject({ rho: 0.5 }, 20, 60, 20))
    expect(dayTotal(low.blocks, day(0))).toBeLessThan(dayTotal(full.blocks, day(0)))
    expect(dayTotal(low.blocks, day(0))).toBeLessThanOrEqual(Math.floor(240 * 0.5 * 0.9))
  })

  it('growth limit after missed days: a ramp from 1.25 × the 7-day average', () => {
    const r = plan(oneSubject({ growthBase: 40 }, 20, 60, 25))
    expect(dayTotal(r.blocks, day(0))).toBeLessThanOrEqual(60)
    expect(dayTotal(r.blocks, day(1))).toBeLessThanOrEqual(75)
    expect(dayTotal(r.blocks, day(2))).toBeLessThanOrEqual(93)
    expect(dayTotal(r.blocks, day(6))).toBeGreaterThan(dayTotal(r.blocks, day(0)))
  })

  it('the growth limit never cuts the buffer before an exam', () => {
    const u = units('a', 6, 60, { level: 1 })
    const s = state({
      subjects: [subject('a')],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(2),
          u.map((x) => x.id),
        ),
      ],
      growthBase: 0,
      settings: { ...state().settings, bufferDays: 2 },
    })
    const r = plan(s)
    expect(r.blocks.filter((b) => b.reason.code === 'buffer').length).toBeGreaterThan(0)
  })

  it('a missed day: its work comes back into later days', () => {
    // Replan after a missed day: the units are still level 0, so they are planned again.
    const s = oneSubject({}, 6, 60, 10)
    const r = plan({ ...s, from: day(1), days: s.days.slice(1) })
    expect(r.blocks[0]!.onDate).toBe(day(1))
    expect(r.blocks[0]!.units[0]!.unitId).toBe('a-u01')
  })

  it('"Danas ne mogu": a day without slots gets no blocks', () => {
    const s = oneSubject({}, 10, 60, 10)
    s.days = s.days.map((d, i) => (i === 0 ? { ...d, slots: [] } : d))
    const r = plan(s)
    expect(dayTotal(r.blocks, day(0))).toBe(0)
    expect(dayTotal(r.blocks, day(1))).toBeGreaterThan(0)
  })
})

describe('plan: manual blocks', () => {
  it('a manual block survives replan: its units count as planned and its time stays free', () => {
    const base = oneSubject({}, 6, 60, 10)
    const s: PlanState = {
      ...base,
      fixed: [
        {
          id: 'm1',
          subjectId: 'a',
          goalId: 'ea',
          onDate: day(2),
          startMin: 9 * 60,
          minutes: 60,
          kind: 'learn',
          origin: 'user',
          units: [{ unitId: 'a-u01', minutes: 60 }],
        },
      ],
    }
    const r = plan(s)
    expect(r.blocks.some((b) => b.units.some((u) => u.unitId === 'a-u01'))).toBe(false)
    for (const b of r.blocks.filter((x) => x.onDate === day(2))) {
      const overlaps = b.startMin! < 10 * 60 + 15 && b.startMin! + b.minutes > 9 * 60
      expect(overlaps).toBe(false)
    }
    expect(r.fixedTimes.m1).toBe(9 * 60)
  })

  it('a manual block without a time gets one, before AI blocks', () => {
    const base = oneSubject({}, 6, 60, 10)
    const r = plan({
      ...base,
      fixed: [
        {
          id: 'm1',
          subjectId: 'a',
          goalId: null,
          onDate: day(0),
          startMin: null,
          minutes: 30,
          kind: 'learn',
          origin: 'user',
          units: [],
        },
      ],
    })
    expect(r.fixedTimes.m1).toBe(9 * 60)
  })
})

describe('plan: times', () => {
  it('reserves breaks inside and after blocks from the default preset', () => {
    const r = plan(oneSubject({}, 20, 60, 20))
    const first = r.blocks
      .filter((b) => b.onDate === day(0))
      .sort((a, b) => a.startMin! - b.startMin!)
    expect(first.length).toBeGreaterThanOrEqual(1)
    for (let i = 1; i < first.length; i++) {
      const prev = first[i - 1]!
      const span =
        prev.minutes + breaksWithin(BUILT_IN_PRESETS[0]!, prev.minutes).reduce((a, b) => a + b, 0)
      expect(first[i]!.startMin!).toBeGreaterThanOrEqual(prev.startMin! + span + 15)
    }
  })

  it('blocks are whole study intervals (50 + 50, not 70)', () => {
    const r = plan(oneSubject({}, 20, 60, 20))
    for (const b of r.blocks.filter((x) => x.kind === 'learn' && x.onDate < day(5)))
      expect(b.minutes % 50).toBe(0)
  })

  it('Pomodoro aligns blocks to 25 minutes', () => {
    const r = plan(oneSubject({ preset: BUILT_IN_PRESETS[1]! }, 20, 60, 20))
    for (const b of r.blocks.filter((x) => x.kind === 'learn' && x.onDate < day(5)))
      expect(b.minutes % 25).toBe(0)
  })

  it('the eve of an exam has no blocks after exam_eve_end_min', () => {
    const u = units('a', 30, 60)
    const s = state({
      subjects: [subject('a')],
      units: u,
      goals: [
        exam(
          'ea',
          'a',
          day(3),
          u.map((x) => x.id),
        ),
      ],
      days: days(28, [{ startMin: 20 * 60, endMin: 24 * 60 }]),
      settings: { ...state().settings, bufferDays: 0 },
    })
    const r = plan(s)
    for (const b of r.blocks.filter((x) => x.onDate === day(2)))
      expect(b.startMin! + b.minutes).toBeLessThanOrEqual(23 * 60)
    expect(r.blocks.some((b) => b.onDate === day(1) && b.startMin! + b.minutes > 23 * 60)).toBe(
      true,
    )
  })

  it('first-pass blocks go to the preferred part of the day', () => {
    const r = plan(oneSubject({ preferredParts: ['evening'] }, 6, 60, 10))
    const first = r.blocks.filter((b) => b.onDate === day(0))
    expect(first.some((b) => b.startMin! >= 19 * 60)).toBe(true)
    expect(first.every((b) => b.minutes <= 100)).toBe(true)
  })

  it('today planned now starts after the current time', () => {
    const r = plan(oneSubject({ nowMin: 15 * 60 }, 6, 60, 10))
    for (const b of r.blocks.filter((x) => x.onDate === day(0)))
      expect(b.startMin!).toBeGreaterThanOrEqual(15 * 60)
  })

  it('splits a long unit across days by pages', () => {
    const u = units('a', 1, 400)
    u[0] = { ...u[0]!, pageStart: 1, pageEnd: 100 }
    const s = state({
      subjects: [subject('a', { priority: 5 })],
      units: u,
      goals: [exam('ea', 'a', day(10), [u[0]!.id])],
    })
    const parts = plan(s).blocks.flatMap((b) => b.units)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts[0]!.pageFrom).toBe(1)
    expect(parts.at(-1)!.pageTo).toBe(100)
    for (let i = 1; i < parts.length; i++)
      expect(parts[i]!.pageFrom!).toBeGreaterThanOrEqual(parts[i - 1]!.pageTo! - 1)
  })
})

describe('plan: determinism', () => {
  it('the same input gives the same plan and the same hash', () => {
    const s = oneSubject({}, 12, 45, 14)
    expect(plan(s)).toEqual(plan(structuredClone(s)))
    expect(inputHash(s)).toBe(inputHash(structuredClone(s)))
  })

  it('any input change changes the hash', () => {
    const s = oneSubject()
    expect(inputHash({ ...s, rho: 0.9 })).not.toBe(inputHash(s))
    expect(inputHash({ ...s, preset: BUILT_IN_PRESETS[1]! })).not.toBe(inputHash(s))
    expect(inputHash({ ...s, subjects: [subject('a', { priority: 4 })] })).not.toBe(inputHash(s))
  })
})

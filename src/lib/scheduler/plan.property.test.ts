import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { mergeSlots } from '@/lib/schedule'
import { BUILT_IN_PRESETS, breakAfterBlock } from '@/lib/session/timer'
import {
  aiCapacity,
  growthLimit,
  plan,
  reservedDays,
  spanOf,
  type FixedBlock,
  type PlanState,
} from '.'
import { FROM, state, subject } from './fixtures'

const DAYS = 21

const slotArb = fc
  .tuple(fc.integer({ min: 6 * 12, max: 23 * 12 }), fc.integer({ min: 1, max: 6 * 12 }))
  .map(([start, len]) => ({ startMin: start * 5, endMin: Math.min(1440, start * 5 + len * 5) }))

const stateArb: fc.Arbitrary<PlanState> = fc
  .record({
    subjectCount: fc.integer({ min: 1, max: 4 }),
    units: fc.array(
      fc.record({
        s: fc.integer({ min: 0, max: 3 }),
        minutes: fc.integer({ min: 10, max: 150 }),
        level: fc.constantFrom(0, 0, 0, 1, 2, 3),
        question: fc.boolean(),
        difficulty: fc.integer({ min: 1, max: 5 }),
        review: fc.option(fc.integer({ min: 0, max: DAYS - 1 }), { nil: null }),
        covered: fc.option(fc.integer({ min: -10, max: 5 }), { nil: null }),
      }),
      { minLength: 1, maxLength: 30 },
    ),
    exams: fc.array(
      fc.record({
        s: fc.integer({ min: 0, max: 3 }),
        on: fc.integer({ min: 0, max: DAYS - 1 }),
        scope: fc.integer({ min: 1, max: 0xffff }),
        eve: fc.boolean(),
        atMin: fc.integer({ min: 8 * 60, max: 18 * 60 }),
      }),
      { minLength: 1, maxLength: 5 },
    ),
    subjects: fc.array(
      fc.record({
        priority: fc.integer({ min: 1, max: 5 }),
        campaign: fc.boolean(),
        manualStart: fc.option(fc.integer({ min: -2, max: DAYS }), { nil: null }),
        boost: fc.option(fc.integer({ min: 0, max: DAYS }), { nil: null }),
        tracked: fc.boolean(),
      }),
      { minLength: 4, maxLength: 4 },
    ),
    days: fc.array(
      fc.record({
        slots: fc.array(slotArb, { maxLength: 3 }),
        cap: fc.integer({ min: 0, max: 400 }),
        lecture: fc.boolean(),
      }),
      { minLength: DAYS, maxLength: DAYS },
    ),
    fixed: fc.array(
      fc.record({
        day: fc.integer({ min: 0, max: DAYS - 1 }),
        start: fc.option(fc.integer({ min: 6 * 12, max: 22 * 12 }), { nil: null }),
        minutes: fc.integer({ min: 15, max: 90 }),
        s: fc.integer({ min: 0, max: 3 }),
      }),
      { maxLength: 3 },
    ),
    rho: fc.double({ min: 0.5, max: 1, noNaN: true }),
    growth: fc.option(fc.integer({ min: 0, max: 200 }), { nil: null }),
    preset: fc.integer({ min: 0, max: 3 }),
    nowMin: fc.option(fc.integer({ min: 6 * 60, max: 22 * 60 }), { nil: null }),
    bufferDays: fc.integer({ min: 0, max: 2 }),
    maxSubjects: fc.integer({ min: 1, max: 3 }),
    minBlock: fc.constantFrom(15, 25, 30),
    recap: fc.boolean(),
    parts: fc.subarray(['morning', 'midday', 'afternoon', 'evening', 'night'] as const),
  })
  .map((r) => {
    const sids = Array.from({ length: r.subjectCount }, (_, i) => `s${i}`)
    const sid = (i: number) => sids[i % sids.length]!
    const units = r.units.map((u, i) => ({
      id: `u${String(i).padStart(2, '0')}`,
      subjectId: sid(u.s),
      sourceId: `src-${sid(u.s)}`,
      order: i,
      kind: u.question ? ('question' as const) : ('chapter' as const),
      level: u.question && u.level === 2 ? 3 : u.level,
      minutes: u.minutes,
      difficulty: u.difficulty,
      confidence: null,
      questionCount: 0,
      pageStart: u.question ? null : i * 10 + 1,
      pageEnd: u.question ? null : i * 10 + 10,
      nextReviewOn: u.review === null ? null : addDays(FROM, u.review),
      coveredOn: u.covered === null ? null : addDays(FROM, u.covered),
      tracked: r.subjects[u.s % r.subjectCount]!.tracked,
    }))
    const goals = r.exams.map((e, i) => ({
      id: `g${i}`,
      subjectId: sid(e.s),
      kind: 'exam' as const,
      on: addDays(FROM, e.on),
      unitIds: units
        .filter((u, j) => u.subjectId === sid(e.s) && (e.scope >> (j % 16)) & 1)
        .map((u) => u.id),
      minutes: 0,
      ...(e.eve ? { eveReserved: true, atMin: e.atMin } : {}),
    }))
    const fixed: FixedBlock[] = r.fixed.map((f, i) => ({
      id: `m${i}`,
      subjectId: sid(f.s),
      goalId: null,
      onDate: addDays(FROM, f.day),
      startMin: f.start === null ? null : f.start * 5,
      minutes: f.minutes,
      kind: 'learn',
      origin: 'user',
      units: [],
    }))
    return state({
      nowMin: r.nowMin,
      subjects: sids.map((id, i) => {
        const x = r.subjects[i]!
        return subject(id, {
          priority: x.priority,
          mode: x.campaign ? 'campaign' : 'regular',
          campaignStartOn: x.manualStart === null ? null : addDays(FROM, x.manualStart),
          boostUntil: x.boost === null ? null : addDays(FROM, x.boost),
        })
      }),
      units,
      goals,
      fixed,
      days: r.days.map((d, i) => ({
        date: addDays(FROM, i),
        slots: mergeSlots(d.slots),
        cap: d.cap,
        lectureSubjectIds: d.lecture ? [sids[i % sids.length]!] : [],
      })),
      rho: Math.round(r.rho * 100) / 100,
      growthBase: r.growth,
      preset: BUILT_IN_PRESETS[r.preset]!,
      preferredParts: r.parts,
      settings: {
        ...state().settings,
        bufferDays: r.bufferDays,
        maxSubjectsPerDay: r.maxSubjects,
        minBlockMinutes: r.minBlock,
        recapAfterLecture: r.recap,
      },
    })
  })

const RUNS = { numRuns: 150 }

describe('plan invariants', () => {
  it('never exceeds a day’s capacity (and the growth limit outside the buffer)', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        const r = plan(s)
        const caps = aiCapacity(s)
        s.days.forEach((d, k) => {
          const blocks = r.blocks.filter((b) => b.onDate === d.date)
          const total = blocks.reduce((sum, b) => sum + b.minutes, 0)
          expect(total).toBeLessThanOrEqual(caps[k]!)
          const growing = blocks
            .filter((b) => b.reason.code !== 'buffer')
            .reduce((sum, b) => sum + b.minutes, 0)
          expect(growing).toBeLessThanOrEqual(growthLimit(s.growthBase, k))
        })
      }),
      RUNS,
    )
  })

  it('study plus breaks fit free slots, without overlaps', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        const r = plan(s)
        s.days.forEach((d, k) => {
          const examEve = s.goals.some((g) => g.on === addDays(d.date, 1))
          const blocks = r.blocks.filter((b) => b.onDate === d.date)
          const spans = blocks.map((b) => {
            expect(b.startMin).not.toBeNull()
            const start = b.startMin!
            const end = start + spanOf(s.preset, b.minutes)
            const inSlot = d.slots.some((x) => x.startMin <= start && end <= x.endMin)
            expect(inSlot).toBe(true)
            if (k === 0 && s.nowMin !== null) expect(start).toBeGreaterThanOrEqual(s.nowMin)
            if (examEve) expect(end).toBeLessThanOrEqual(s.settings.examEveEndMin)
            return { start, end, rest: end + breakAfterBlock(s.preset, b.minutes) }
          })
          const fixed = s.fixed
            .filter((f) => f.onDate === d.date && f.startMin !== null)
            .map((f) => ({ start: f.startMin!, end: f.startMin! + spanOf(s.preset, f.minutes) }))
          const sorted = [...spans].sort((a, b) => a.start - b.start)
          for (let i = 1; i < sorted.length; i++)
            expect(sorted[i]!.start).toBeGreaterThanOrEqual(sorted[i - 1]!.rest)
          for (const a of spans)
            for (const f of fixed) expect(a.end <= f.start || a.start >= f.end).toBe(true)
        })
      }),
      RUNS,
    )
  })

  it('a reserved day before an exam has no AI block of another subject', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        const reserved = reservedDays(s)
        const r = plan(s)
        for (const [day, goal] of reserved) {
          expect(day < goal.on).toBe(true)
          for (const b of r.blocks.filter((x) => x.onDate === day))
            expect(b.subjectId).toBe(goal.subjectId)
        }
        // One exam per reserved day, one day per exam.
        expect(new Set([...reserved.values()].map((g) => g.id)).size).toBe(reserved.size)
      }),
      RUNS,
    )
  })

  it('reviews never fall on or after their own exam', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        const r = plan(s)
        for (const b of r.blocks.filter((x) => x.kind === 'review' && x.goalId)) {
          const goal = s.goals.find((g) => g.id === b.goalId)!
          expect(b.onDate < goal.on).toBe(true)
        }
      }),
      RUNS,
    )
  })

  it('leaves manual blocks unchanged', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        const before = structuredClone(s.fixed)
        const r = plan(s)
        expect(s.fixed).toEqual(before)
        for (const f of s.fixed) {
          expect(r.blocks.some((b) => b.key.includes(f.id))).toBe(false)
          if (f.startMin !== null && s.days.some((d) => d.date === f.onDate))
            expect(r.fixedTimes[f.id]).toBe(f.startMin)
        }
      }),
      RUNS,
    )
  })

  it('re-placing today: AI blocks never before now, manual blocks keep their time, nothing added', () => {
    const replaced = fc
      .tuple(
        stateArb,
        fc.integer({ min: 6 * 60, max: 22 * 60 }),
        fc.array(fc.integer({ min: 15, max: 100 }), { minLength: 1, maxLength: 3 }),
      )
      .map(([s, now, minutes]): PlanState => {
        const ai: FixedBlock[] = minutes.map((m, i) => ({
          id: `ai${i}`,
          subjectId: s.subjects[0]!.id,
          goalId: null,
          onDate: FROM,
          startMin: null,
          minutes: m,
          kind: 'learn',
          origin: 'ai',
          units: [],
        }))
        return {
          ...s,
          nowMin: Math.round(now / 5) * 5,
          fixed: [...s.fixed, ...ai],
          days: s.days.map((d, k) => (k === 0 ? { ...d, cap: 0 } : d)),
        }
      })
    fc.assert(
      fc.property(replaced, (s) => {
        const r = plan(s)
        expect(r.blocks.filter((b) => b.onDate === FROM)).toEqual([])
        for (const f of s.fixed) {
          const at = r.fixedTimes[f.id]
          if (f.origin === 'ai' && at !== undefined) expect(at).toBeGreaterThanOrEqual(s.nowMin!)
          if (f.startMin !== null && f.onDate === FROM) expect(at).toBe(f.startMin)
        }
      }),
      RUNS,
    )
  })

  it('the same input gives the same plan and the same times, in any input order', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        const shuffled: PlanState = {
          ...structuredClone(s),
          subjects: [...s.subjects].reverse(),
          units: [...s.units].reverse(),
          goals: [...s.goals].reverse(),
        }
        expect(plan(shuffled)).toEqual(plan(s))
      }),
      RUNS,
    )
  })
})

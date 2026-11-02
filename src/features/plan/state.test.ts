import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { addDays, zonedInstant } from '@/lib/day'
import { inputHash, plan } from '@/lib/scheduler'
import type { DayInput } from '@/lib/schedule'
import { fitCompletion } from '@/lib/slots/completion'
import { assessmentRow, subjectRow } from '@/features/subjects/fixtures'
import type { Assessment } from '@/features/subjects/model'
import type { SourceWithUnits, Unit } from '@/features/sources/model'
import { applyReplace, reasonOf, replaceArgs, todayMoves } from './save'
import {
  gainedToday,
  buildPlanState,
  historyOf,
  isActiveExam,
  roughScopeRows,
  type PlanBlockRow,
  type PlanInputs,
  type Profile,
} from './state'

const TZ = 'Europe/Sarajevo'
const boundary = { timeZone: TZ, dayStartMin: 240 }
const TODAY = '2026-10-21'
const NOW = zonedInstant(TODAY, 10 * 60, TZ)

const profile = (patch: Partial<Profile> = {}): Profile => ({
  id: 'u',
  display_name: 'Uma',
  locale: 'bs',
  timezone: TZ,
  day_start_min: 240,
  daily_cap_min: [180, 180, 180, 180, 180, 300, 300],
  buffer_days: 1,
  max_subjects_per_day: 3,
  min_block_minutes: 25,
  recap_after_lecture: false,
  lecture_pace_days: 7,
  exam_eve_end_min: 1380,
  default_preset: 'standard',
  session_presets: [],
  preferred_slots: [],
  points_total: 100,
  grade_scale: null,
  ics_token: null,
  name_confirmed_at: null,
  onboarded_at: null,
  onboarding_step: 0,
  sleep_min: null,
  wake_min: null,
  theme: 'lavender',
  review_cap_pct: 40,
  fsrs_params: null,
  notify_first_block: true,
  notify_break_end: true,
  reminder_offsets_min: [30],
  institution: null,
  study_program: null,
  year_of_study: null,
  academic_search: null,
  timer_mode: 'standard',
  created_at: '',
  updated_at: '',
  ...patch,
})

const unit = (id: string, position: number, patch: Partial<Unit> = {}): Unit => ({
  id,
  source_id: 'src',
  parent_id: null,
  kind: 'chapter',
  position,
  label: String(position + 1),
  title: `Part ${position + 1}`,
  page_start: null,
  page_end: null,
  amount: 1,
  ai_difficulty: null,
  user_difficulty: null,
  level: 0,
  level_source: null,
  confidence: null,
  est_minutes: null,
  next_review_on: null,
  completed_at: null,
  archived_at: null,
  notes: null,
  answer: null,
  answer_origin: null,
  fsrs_stability: null,
  fsrs_difficulty: null,
  fsrs_state: null,
  fsrs_reps: 0,
  fsrs_lapses: 0,
  review_streak: 0,
  read_amount: null,
  last_review_at: null,
  created_at: '',
  updated_at: '',
  user_id: 'u',
  ...patch,
})

const roughSource = (parts: number): SourceWithUnits => ({
  id: 'src',
  user_id: 'u',
  subject_id: 's',
  kind: 'other',
  title: '~',
  archived_at: null,
  author: null,
  measure: 'items',
  base_min_per_unit: 60,
  learned_min_per_unit: null,
  learned_samples: 0,
  measured_sessions: 0,
  weight: null,
  is_rough: true,
  file_name: null,
  drive_file_id: null,
  external_url: null,
  created_at: '',
  updated_at: '',
  units: Array.from({ length: parts }, (_, i) => unit(`p${i}`, i)),
})

const dayInput = (): DayInput => ({
  rules: Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    startMin: 9 * 60,
    endMin: 21 * 60,
  })),
  exceptions: [],
  entries: [],
  periods: [],
  caps: [180, 180, 180, 180, 180, 300, 300],
  timeZone: TZ,
})

function inputs(patch: Partial<PlanInputs> = {}): PlanInputs {
  const exam1 = assessmentRow({
    id: 'e1',
    subject_id: 's',
    at: zonedInstant('2026-11-10', 540, TZ).toISOString(),
  })
  const exam2 = assessmentRow({
    id: 'e2',
    subject_id: 's',
    title: 'II parcijala',
    at: zonedInstant('2026-12-20', 540, TZ).toISOString(),
  })
  return {
    energy: [],
    profile: profile(),
    subjects: [{ ...subjectRow({ id: 's' }), assessments: [exam1, exam2] }],
    deadlines: [],
    sources: [roughSource(10)],
    scope: [],
    unitTopics: [],
    questionLinks: [],
    cards: [],
    logs: [],
    blocks: [],
    sessions: [],
    completion: fitCompletion([], '2026-10-29'),
    globalScale: undefined,
    dayInput,
    ...patch,
  }
}

describe('buildPlanState', () => {
  it('a unit is due with its earliest card, and carries its memory and the review cap', () => {
    const src = roughSource(10)
    src.units[0] = {
      ...src.units[0]!,
      level: 2,
      next_review_on: '2026-11-01',
      fsrs_stability: 12.34567,
      fsrs_difficulty: 5,
      fsrs_state: 2,
      fsrs_reps: 2,
      last_review_at: zonedInstant('2026-10-20', 22 * 60, TZ).toISOString(),
    }
    const card = (id: string, on: string | null) => ({
      id,
      unit_id: 'p0',
      next_review_on: on,
      fsrs_stability: null,
      fsrs_difficulty: null,
      fsrs_state: null,
      fsrs_reps: 0,
      fsrs_lapses: 0,
      review_streak: 0,
      last_review_at: null,
    })
    const { state } = buildPlanState(
      inputs({
        sources: [src],
        cards: [card('c1', '2026-10-28'), card('c2', null), card('c3', '2026-10-25')],
        profile: profile({ review_cap_pct: 25 }),
      }),
      { now: NOW, boundary },
    )
    const u = state.units.find((x) => x.id === 'p0')!
    expect(u.nextReviewOn).toBe('2026-10-25')
    expect(u.memory).toEqual({ stability: 12.346, difficulty: 5, lastReviewOn: '2026-10-20' })
    expect(state.units.find((x) => x.id === 'p1')!.memory).toBeNull()
    expect(state.settings.reviewCapPct).toBe(25)
  })

  it('splits a rough source over the partial exams in order', () => {
    const { state } = buildPlanState(inputs(), { now: NOW, boundary })
    expect(state.goals.map((g) => [g.id, g.on, g.unitIds.length])).toEqual([
      ['e1', '2026-11-10', 5],
      ['e2', '2026-12-20', 5],
    ])
    expect(state.goals[0]!.unitIds).toEqual(['p0', 'p1', 'p2', 'p3', 'p4'])
    expect(state.units.find((u) => u.id === 'p0')!.minutes).toBe(60)
  })

  it('plans today from now on its first opening, then keeps today', () => {
    const first = buildPlanState(inputs(), { now: NOW, boundary })
    expect(first.state.from).toBe(TODAY)
    expect(first.state.nowMin).toBe(600)
    const result = plan(first.state)
    const args = replaceArgs(first, result, inputHash(first.state), 'run1', TZ)
    const blocks = applyReplace([], args, 'u')
    const second = buildPlanState(inputs({ blocks }), { now: NOW, boundary })
    expect(second.keepToday).toBe(true)
    expect(second.state.from).toBe(addDays(TODAY, 1))
    expect(second.state.fixed.every((f) => f.onDate === TODAY && f.origin === 'ai')).toBe(true)
    // Today's units count as planned: nothing of today's work is planned again.
    const today = new Set(
      blocks
        .filter((b) => b.on_date === TODAY)
        .flatMap((b) => b.plan_block_units.map((u) => u.unit_id)),
    )
    const again = plan(second.state).blocks.filter((b) =>
      b.units.some((u) => today.has(u.unitId) && u.minutes >= 60),
    )
    expect(again).toEqual([])
  })

  it('energy for today rebuilds today with less; the hash changes; other days are normal', () => {
    const first = buildPlanState(inputs(), { now: NOW, boundary })
    const blocks = applyReplace(
      [],
      replaceArgs(first, plan(first.state), inputHash(first.state), 'run1', TZ),
      'u',
    )
    const normal = buildPlanState(inputs({ blocks }), { now: NOW, boundary })
    const low = buildPlanState(inputs({ blocks, energy: [{ on_date: TODAY, energy: 'low' }] }), {
      now: NOW,
      boundary,
    })
    expect(low.keepToday).toBe(false)
    expect(low.state.from).toBe(TODAY)
    expect(low.state.days[0]).toMatchObject({ date: TODAY, energy: 'low' })
    expect(low.state.days[1]!.energy).toBeUndefined()
    expect(low.state.energyFactors).toEqual({ low: 0.6, high: 1.25 })
    expect(inputHash(low.state)).not.toBe(inputHash(normal.state))
    const todayMinutes = (s: typeof low) =>
      plan(s.state)
        .blocks.filter((b) => b.onDate === TODAY)
        .reduce((sum, b) => sum + b.minutes, 0)
    const fresh = buildPlanState(inputs({ energy: [] }), { now: NOW, boundary })
    expect(todayMinutes(low)).toBeLessThanOrEqual(todayMinutes(fresh))
  })

  it('saves what the plan knew about each block (block completion features)', () => {
    const built = buildPlanState(inputs(), { now: NOW, boundary })
    const result = plan(built.state)
    const args = replaceArgs(built, result, 'h', 'r', TZ)
    const goalOn = new Map(built.state.goals.map((g) => [g.id, g.on]))
    for (const [i, b] of result.blocks.entries()) {
      const row = args.p_blocks[i]!
      const load = result.blocks
        .filter((x) => x.onDate === b.onDate)
        .reduce((s, x) => s + x.minutes, 0)
      expect(row.day_load_min).toBe(Math.round(load))
      expect(row.days_to_goal).toBe(
        b.goalId
          ? Math.round((Date.parse(goalOn.get(b.goalId)!) - Date.parse(b.onDate)) / 864e5)
          : null,
      )
      expect(row.demand).toBeCloseTo(b.demand, 3)
    }
    expect(args.p_blocks.some((b) => b.days_to_goal !== null && b.days_to_goal > 0)).toBe(true)
    const [saved] = applyReplace([], args, 'u')
    expect(saved!.plan_start_min).toBe(saved!.start_min)
  })

  it('keeps today after its only block was skipped to tomorrow ("Preskoči")', () => {
    const first = buildPlanState(inputs(), { now: NOW, boundary })
    const blocks = applyReplace([], replaceArgs(first, plan(first.state), 'h', 'r', TZ), 'u')
    const tomorrow = addDays(TODAY, 1)
    const moved = blocks.map((b) =>
      b.on_date === TODAY
        ? {
            ...b,
            on_date: tomorrow,
            origin: 'user' as const,
            reason: JSON.stringify({ code: 'manual', mode: 'reading', carried: true, from: TODAY }),
          }
        : b,
    )
    expect(moved.some((b) => b.on_date === TODAY && b.origin === 'ai')).toBe(false)
    const built = buildPlanState(inputs({ blocks: moved }), { now: NOW, boundary })
    expect(built.keepToday).toBe(true)
    expect(built.state.from).toBe(tomorrow)
  })

  it('replans today when its blocks no longer fit (busy day added)', () => {
    const first = buildPlanState(inputs(), { now: NOW, boundary })
    const blocks = applyReplace([], replaceArgs(first, plan(first.state), 'h', 'r', TZ), 'u')
    const busy = () => ({
      ...dayInput(),
      exceptions: [{ onDate: TODAY, startMin: null, endMin: null, isBusy: true }],
    })
    const built = buildPlanState(inputs({ blocks, dayInput: busy }), { now: NOW, boundary })
    expect(built.keepToday).toBe(false)
    expect(built.state.from).toBe(TODAY)
  })

  it('today’s free time is in the slots key; a changed day re-places today’s AI blocks from now', () => {
    const first = buildPlanState(inputs(), { now: NOW, boundary })
    const blocks = applyReplace([], replaceArgs(first, plan(first.state), 'h', 'r', TZ), 'u')
    const todays = blocks.filter((b) => b.on_date === TODAY)
    expect(todays.length).toBeGreaterThan(0)
    // Free from 16:00 today only (a class until then); today may be the week's exploring day, so
    // its first block may already sit in the afternoon.
    const later = () => ({
      ...dayInput(),
      exceptions: [{ onDate: TODAY, startMin: 9 * 60, endMin: 16 * 60, isBusy: true }],
    })
    const kept = buildPlanState(inputs({ blocks, dayInput: later }), { now: NOW, boundary })
    expect(kept.keepToday).toBe(true)
    expect(kept.todaySlotsKey).not.toBe(
      buildPlanState(inputs({ blocks }), { now: NOW, boundary }).todaySlotsKey,
    )
    expect(kept.replaceFrom).toBe(addDays(TODAY, 1))

    const re = buildPlanState(inputs({ blocks, dayInput: later }), {
      now: NOW,
      boundary,
      replaceToday: true,
    })
    expect(re.replacedToday).toBe(true)
    expect(re.state.from).toBe(TODAY)
    expect(re.replaceFrom).toBe(addDays(TODAY, 1))
    const result = plan(re.state)
    // Nothing new today: the day only moves.
    expect(result.blocks.filter((b) => b.onDate === TODAY)).toEqual([])
    const moves = todayMoves(re, result, blocks)
    expect(moves.length).toBeGreaterThan(0)
    for (const m of moves) expect(m.startMin).toBeGreaterThanOrEqual(16 * 60)
    // A block that was not moved still fits: every today block now starts at 16:00 or later.
    for (const b of todays)
      expect(
        moves.find((m) => m.block.id === b.id)?.startMin ?? b.start_min!,
      ).toBeGreaterThanOrEqual(16 * 60)
  })

  it('a manual block is fixed; the hash changes when any input changes', () => {
    const manual: PlanBlockRow = {
      id: 'm1',
      user_id: 'u',
      subject_id: 's',
      assessment_id: null,
      deadline_id: null,
      on_date: addDays(TODAY, 2),
      start_min: 600,
      planned_start: null,
      planned_minutes: 60,
      kind: 'learn',
      status: 'planned',
      reason: null,
      plan_run_id: null,
      origin: 'user',
      title: 'Vježbe',
      skip_requested_at: null,
      plan_start_min: null,
      day_load_min: null,
      days_to_goal: null,
      demand: null,
      created_at: '',
      updated_at: '',
      plan_block_units: [],
    }
    const a = buildPlanState(inputs({ blocks: [manual] }), { now: NOW, boundary })
    expect(a.state.fixed).toEqual([
      expect.objectContaining({ id: 'm1', startMin: 600, origin: 'user' }),
    ])
    const b = buildPlanState(
      inputs({ blocks: [manual], profile: profile({ default_preset: 'pomodoro' }) }),
      { now: NOW, boundary },
    )
    expect(inputHash(a.state)).not.toBe(inputHash(b.state))
  })

  it('a reserved exam eve is a scheduler input (goal and input hash)', () => {
    const plain = buildPlanState(inputs(), { now: NOW, boundary })
    const reserved = inputs()
    reserved.subjects[0]!.assessments[0] = {
      ...reserved.subjects[0]!.assessments[0]!,
      eve_reserved: true,
    }
    const built = buildPlanState(reserved, { now: NOW, boundary })
    expect(built.state.goals.find((g) => g.id === 'e1')).toMatchObject({
      eveReserved: true,
      atMin: 540,
    })
    expect(inputHash(built.state)).not.toBe(inputHash(plain.state))
    // Declined (false) is the same plan as never asked.
    const declined = inputs()
    declined.subjects[0]!.assessments[0] = {
      ...declined.subjects[0]!.assessments[0]!,
      eve_reserved: false,
    }
    expect(inputHash(buildPlanState(declined, { now: NOW, boundary }).state)).toBe(
      inputHash(plain.state),
    )
  })

  it('soft deadlines come from lecture logs', () => {
    const built = buildPlanState(
      inputs({
        logs: [
          {
            id: 'l1',
            user_id: 'u',
            subject_id: 's',
            on_date: '2026-10-20',
            source_id: 'src',
            up_to_unit_id: 'p2',
            timetable_entry_id: null,
            cancelled: false,
            note: null,
            created_at: '2026-10-20T10:00:00Z',
            updated_at: '',
          },
        ],
      }),
      { now: NOW, boundary },
    )
    const p1 = built.state.units.find((u) => u.id === 'p1')!
    expect(p1).toMatchObject({ coveredOn: '2026-10-20', tracked: true })
    expect(built.state.units.find((u) => u.id === 'p5')!.coveredOn).toBeNull()
  })
})

describe('plan state helpers', () => {
  it('gainedToday: free minutes from now that today gained', () => {
    const key = (slots: [number, number][], on = TODAY) => JSON.stringify({ on, slots, manual: [] })
    // 17–19 → 16–19 at 10:00: one hour more.
    expect(gainedToday(key([[1020, 1140]]), key([[960, 1140]]), 600)).toBe(60)
    // The gained hour is already past at 17:00.
    expect(gainedToday(key([[1020, 1140]]), key([[960, 1140]]), 1020)).toBe(0)
    expect(gainedToday(key([[960, 1140]]), key([[1020, 1140]]), 600)).toBe(0)
    expect(gainedToday(key([[1020, 1140]], '2026-10-20'), key([[960, 1140]]), 600)).toBe(0)
    expect(gainedToday('x', key([[960, 1140]]), 600)).toBe(0)
  })

  it('a makeup is active only when its exam failed', () => {
    const first = assessmentRow({
      id: 'a',
      result_points: 10,
      result_max: 40,
      points_max: 40,
      pass_min_pct: 50,
    })
    const makeup = assessmentRow({ id: 'm', kind: 'makeup', retake_of: 'a', contingent: true })
    const subject = { ...subjectRow({ id: 's' }), assessments: [first, makeup] }
    expect(isActiveExam(makeup, subject, [])).toBe(true)
    const passed = {
      ...subject,
      assessments: [{ ...first, result_points: 30, passed: true }, makeup],
    }
    expect(isActiveExam(makeup, passed, [])).toBe(false)
  })

  it('roughScopeRows keeps manual rows and splits the rest', () => {
    const units = ['a', 'b', 'c'].map((id) => ({ id }))
    expect(
      roughScopeRows(
        units,
        [{ id: 'I' }, { id: 'II' }],
        [{ assessmentId: 'II', unitId: 'a', included: true }],
      ),
    ).toEqual([
      { assessmentId: 'I', unitId: 'b', included: true },
      { assessmentId: 'II', unitId: 'c', included: true },
    ])
  })

  it('history: planned AI minutes, done minutes on them and skipped days', () => {
    const block = (id: string, on: string, status: PlanBlockRow['status']) =>
      ({ id, on_date: on, origin: 'ai', status, planned_minutes: 60 }) as PlanBlockRow
    const h = historyOf(
      [block('b1', '2026-10-19', 'done'), block('b2', '2026-10-20', 'skipped')],
      [
        {
          startedAt: zonedInstant('2026-10-19', 600, TZ).toISOString(),
          blockId: 'b1',
          minutes: 45,
        },
      ],
      boundary,
      TODAY,
    )
    expect(h).toEqual([
      { date: '2026-10-19', plannedMin: 60, doneAiMin: 45, studiedMin: 45, skipped: false },
      { date: '2026-10-20', plannedMin: 0, doneAiMin: 0, studiedMin: 0, skipped: true },
    ])
  })

  it('reasons round-trip through plan_blocks.reason', () => {
    expect(reasonOf({ reason: JSON.stringify({ code: 'exam', days: 3 }) })).toEqual({
      code: 'exam',
      days: 3,
    })
    expect(reasonOf({ reason: 'old text' })).toBeNull()
  })
})

describe('scope after a partial exam (Sprint 17)', () => {
  const LATER = zonedInstant('2026-11-15', 600, TZ)
  const at = (date: string) => zonedInstant(date, 540, TZ).toISOString()
  const failed = { result_points: 10, result_max: 40, points_max: 40, pass_min_pct: 50 }
  const exam1 = (patch: Partial<Assessment> = {}) =>
    assessmentRow({ id: 'e1', subject_id: 's', at: at('2026-11-10'), ...patch })
  const exam2 = assessmentRow({
    id: 'e2',
    subject_id: 's',
    title: 'II parcijala',
    at: at('2026-12-20'),
  })
  const makeup = assessmentRow({
    id: 'm',
    subject_id: 's',
    kind: 'makeup',
    title: 'Popravni',
    retake_of: 'e1',
    contingent: true,
    at: at('2026-11-25'),
  })
  const integral = assessmentRow({
    id: 'i',
    subject_id: 's',
    kind: 'integral',
    title: 'Integralni',
    scope_all: true,
    contingent: true,
    at: at('2027-01-20'),
  })
  /** Every part studied and due for review, so only scope keeps a part out of the plan. */
  const studied = (parts: number) => {
    const src = roughSource(parts)
    src.units = src.units.map((u) => ({ ...u, level: 2, next_review_on: '2026-11-16' }))
    return src
  }
  const run = (assessments: Assessment[], parts = 10, now = LATER) => {
    const built = buildPlanState(
      inputs({
        subjects: [{ ...subjectRow({ id: 's' }), assessments }],
        sources: [studied(parts)],
      }),
      { now, boundary },
    )
    const planned = new Set(plan(built.state).blocks.flatMap((b) => b.units.map((u) => u.unitId)))
    return { goals: built.state.goals, planned }
  }
  const firstHalf = ['p0', 'p1', 'p2', 'p3', 'p4']
  const secondHalf = ['p5', 'p6', 'p7', 'p8', 'p9']

  it('after I, its half leaves the plan (no learning, no reviews), passed or not', () => {
    for (const first of [exam1(), exam1({ passed: true, result_points: 30, result_max: 40 })]) {
      const { goals, planned } = run([first, exam2])
      expect(goals.map((g) => [g.id, g.unitIds])).toEqual([['e2', secondHalf]])
      expect(firstHalf.some((id) => planned.has(id))).toBe(false)
      expect(secondHalf.some((id) => planned.has(id))).toBe(true)
    }
  })

  it('a makeup inherits the scope of the exam it repeats', () => {
    const { goals, planned } = run([exam1(failed), exam2, makeup])
    expect(goals.find((g) => g.id === 'm')!.unitIds).toEqual(firstHalf)
    expect(goals.find((g) => g.id === 'e2')!.unitIds).toEqual(secondHalf)
    expect(firstHalf.some((id) => planned.has(id))).toBe(true)
  })

  it('an integral’s makeup covers everything', () => {
    const intMakeup = { ...makeup, retake_of: 'i', at: at('2027-02-01') }
    const failedIntegral = { ...integral, at: at('2026-11-12'), ...failed }
    const { goals } = run([exam1(failed), exam2, failedIntegral, intMakeup])
    expect(goals.find((g) => g.id === 'm')!.unitIds).toEqual([...firstHalf, ...secondHalf])
  })

  it('an active integral or a final with the whole material keeps the first half', () => {
    const final = assessmentRow({
      id: 'f',
      subject_id: 's',
      kind: 'final',
      scope_all: true,
      at: at('2027-01-25'),
    })
    for (const extra of [integral, final]) {
      const { goals, planned } = run([exam1(failed), exam2, extra])
      expect(goals.find((g) => g.id === extra.id)!.unitIds).toEqual([...firstHalf, ...secondHalf])
      expect(firstHalf.some((id) => planned.has(id))).toBe(true)
    }
  })

  it('a subject with only an integral keeps everything until it', () => {
    const { goals } = run([{ ...integral, contingent: false }])
    expect(goals.map((g) => [g.id, g.unitIds])).toEqual([['i', [...firstHalf, ...secondHalf]]])
  })

  it('property: after I without a makeup or integral, no block holds I’s parts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 14 }),
        fc.integer({ min: 1, max: 30 }),
        fc.constantFrom('none', 'passed', 'failed'),
        (parts, after, result) => {
          const first = exam1(
            result === 'passed'
              ? { passed: true, result_points: 30, result_max: 40 }
              : result === 'failed'
                ? failed
                : {},
          )
          const now = zonedInstant(addDays('2026-11-10', after), 600, TZ)
          const { planned } = run([first, exam2], parts, now)
          for (let i = 0; i < parts; i++) {
            if (Math.floor((i * 2) / parts) === 0) expect(planned.has(`p${i}`)).toBe(false)
          }
        },
      ),
      { numRuns: 30 },
    )
  })
})

describe('slot signals in the plan (Sprint 17)', () => {
  const session = (date: string, minutes: number, focus: number) => ({
    startedAt: zonedInstant(date, minutes, TZ).toISOString(),
    blockId: null,
    minutes: 50,
    focus,
    focusReasons: null,
    distractions: 0,
    appLeaves: 0,
    units: [],
  })
  const days = Array.from({ length: 10 }, (_, i) => addDays(TODAY, -1 - i))
  const signals = {
    sessions: days.flatMap((d) => [session(d, 20 * 60, 3), session(d, 9 * 60, 1)]),
    plannedStart: new Map<string, string>(),
  }

  it('better focus in the evening raises its slot score; the hash follows', () => {
    const plain = buildPlanState(inputs(), { now: NOW, boundary }).state
    const nudged = buildPlanState(inputs({ signals }), { now: NOW, boundary }).state
    const weekday = (s: typeof plain) => s.slotScores!.weekday
    expect(weekday(nudged).evening).toBeGreaterThan(weekday(plain).evening)
    expect(weekday(nudged).morning).toBeLessThan(weekday(plain).morning)
    expect(inputHash(nudged)).not.toBe(inputHash(plain))
    // No sessions: the same state as without signals.
    const empty = buildPlanState(inputs({ signals: { sessions: [], plannedStart: new Map() } }), {
      now: NOW,
      boundary,
    }).state
    expect(inputHash(empty)).toBe(inputHash(plain))
  })
})

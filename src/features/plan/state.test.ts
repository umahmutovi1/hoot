import { describe, expect, it } from 'vitest'
import { addDays, zonedInstant } from '@/lib/day'
import { inputHash, plan } from '@/lib/scheduler'
import type { DayInput } from '@/lib/schedule'
import { assessmentRow, subjectRow } from '@/features/subjects/fixtures'
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
  author: null,
  measure: 'items',
  base_min_per_unit: 60,
  learned_min_per_unit: null,
  learned_samples: 0,
  measured_sessions: 0,
  weight: null,
  is_rough: true,
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
    expect(u.memory).toEqual({ stability: 12.346, lastReviewOn: '2026-10-20' })
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
    // Free from 15:00 today only (a class until then).
    const later = () => ({
      ...dayInput(),
      exceptions: [{ onDate: TODAY, startMin: 9 * 60, endMin: 15 * 60, isBusy: true }],
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
    for (const m of moves) expect(m.startMin).toBeGreaterThanOrEqual(15 * 60)
    // A block that was not moved still fits: every today block now starts at 15:00 or later.
    for (const b of todays)
      expect(
        moves.find((m) => m.block.id === b.id)?.startMin ?? b.start_min!,
      ).toBeGreaterThanOrEqual(15 * 60)
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

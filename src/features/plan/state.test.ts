import { describe, expect, it } from 'vitest'
import { addDays, zonedInstant } from '@/lib/day'
import { inputHash, plan } from '@/lib/scheduler'
import type { DayInput } from '@/lib/schedule'
import { assessmentRow, subjectRow } from '@/features/subjects/fixtures'
import type { SourceWithUnits, Unit } from '@/features/sources/model'
import { applyReplace, reasonOf, replaceArgs } from './save'
import {
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
  srs_multiplier: 1,
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
  srs_ease: 2.5,
  srs_interval_days: null,
  srs_success_count: 0,
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
    logs: [],
    blocks: [],
    sessions: [],
    globalScale: undefined,
    dayInput,
    ...patch,
  }
}

describe('buildPlanState', () => {
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

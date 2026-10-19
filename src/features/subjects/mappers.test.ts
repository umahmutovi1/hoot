import { describe, expect, it } from 'vitest'
import {
  assessmentToForm,
  deadlineToForm,
  subjectToForm,
  toAssessmentRow,
  toDeadlineRow,
  toSubjectRow,
} from './mappers'
import { examAtFromDate, examKindDefaults, localDateOf, nextAssessment } from './model'
import { assessmentRow as assessment, deadlineRow, subjectRow } from './fixtures'
import { EXAM_GRADE_DEFAULTS, GRADE_FIELD_DEFAULTS } from './schemas'

describe('dates', () => {
  it('round-trips a local exam date', () => {
    expect(localDateOf(examAtFromDate('2026-10-28'))).toBe('2026-10-28')
    expect(new Date(examAtFromDate('2026-10-28')).getHours()).toBe(9)
  })
})

describe('subject mapping', () => {
  it('drops the manual campaign start in regular mode', () => {
    const row = toSubjectRow({
      id: 's',
      name: 'Baze',
      color: 'lavender',
      priority: 4,
      studyMode: 'regular',
      campaignStartOn: '2026-12-02',
      assessments: [],
    })
    expect(row.campaign_start_on).toBeNull()
    expect(row.priority).toBe(4)
  })

  it('maps a stored subject back to a form with exams sorted by date', () => {
    const later = assessment({ title: 'II parcijala', at: examAtFromDate('2026-12-09') })
    const earlier = assessment({ title: 'I parcijala', date_tentative: true })
    const form = subjectToForm({
      ...subjectRow({ color: 'unknown', priority: 5, study_mode: 'campaign' }),
      assessments: [later, earlier],
    })
    expect(form.color).toBe('lavender')
    expect(form.assessments.map((a) => a.title)).toEqual(['I parcijala', 'II parcijala'])
    expect(form.assessments[0]?.dateTentative).toBe(true)
  })
})

describe('exam date range', () => {
  const form = {
    id: 'a',
    kind: 'partial' as const,
    title: 'II parcijala',
    date: '2026-12-01',
    format: 'written' as const,
    scopeAll: false,
    contingent: false,
    dateTentative: true,
    dateLatest: '2026-12-12',
    examPeriodId: 'period-1',
    ...EXAM_GRADE_DEFAULTS,
  }

  it('stores the range end only for tentative exams', () => {
    expect(localDateOf(toAssessmentRow('s', form).at_latest!)).toBe('2026-12-12')
    expect(toAssessmentRow('s', { ...form, dateTentative: false }).at_latest).toBeNull()
  })

  it('keeps the exam period only while the date is tentative', () => {
    expect(toAssessmentRow('s', form).exam_period_id).toBe('period-1')
    expect(toAssessmentRow('s', { ...form, dateTentative: false }).exam_period_id).toBeNull()
  })

  it('round-trips the range', () => {
    const row = toAssessmentRow('s', form)
    const back = assessmentToForm(
      assessment({ at: row.at, at_latest: row.at_latest ?? null, date_tentative: true }),
    )
    expect([back.date, back.dateLatest]).toEqual(['2026-12-01', '2026-12-12'])
  })

  it('stores points, but lets a makeup carry the points of the exam it repeats', () => {
    const graded = { ...form, pointsMax: 40, passMinPct: 50, retakeOf: 'x' }
    expect(toAssessmentRow('s', graded)).toMatchObject({ points_max: 40, retake_of: null })
    expect(toAssessmentRow('s', { ...graded, kind: 'makeup' })).toMatchObject({
      points_max: null,
      pass_min_pct: 50,
      retake_of: 'x',
    })
  })
})

describe('deadline mapping', () => {
  it('converts hours to minutes and back', () => {
    const row = toDeadlineRow({
      id: 'd',
      subjectId: null,
      title: 'Seminarski',
      kind: 'assignment',
      date: '2026-10-23',
      estHours: 4.5,
      notes: '',
      ...GRADE_FIELD_DEFAULTS,
    })
    expect(row.est_minutes).toBe(270)
    expect(row.notes).toBeNull()
    const form = deadlineToForm(
      deadlineRow({ id: 'd', kind: 'assignment', due_at: row.due_at, est_minutes: 270 }),
    )
    expect(form.estHours).toBe(4.5)
    expect(form.date).toBe('2026-10-23')
  })
})

describe('nextAssessment', () => {
  const now = new Date(2026, 9, 19, 12)

  it('skips past and passed exams and prefers non-contingent ones', () => {
    const past = assessment({ at: examAtFromDate('2026-10-01') })
    const passed = assessment({ at: examAtFromDate('2026-10-20'), passed: true })
    const integral = assessment({ at: examAtFromDate('2026-10-25'), contingent: true })
    const partial = assessment({ at: examAtFromDate('2026-11-04') })
    expect(nextAssessment([past, passed, integral, partial], now)).toBe(partial)
  })

  it('falls back to a contingent exam when nothing else is left', () => {
    const integral = assessment({ at: examAtFromDate('2027-01-27'), contingent: true })
    expect(nextAssessment([integral], now)).toBe(integral)
  })

  it('counts an exam later today as upcoming', () => {
    const today = assessment({ at: examAtFromDate('2026-10-19') })
    expect(nextAssessment([today], now)).toBe(today)
  })
})

describe('examKindDefaults', () => {
  it('turns all material on for the integral and only-if-needed for it and the makeup', () => {
    expect(examKindDefaults('integral')).toEqual({ scopeAll: true, contingent: true })
    expect(examKindDefaults('makeup')).toEqual({ scopeAll: false, contingent: true })
    for (const kind of ['partial', 'final', 'other'] as const) {
      expect(examKindDefaults(kind)).toEqual({ scopeAll: false, contingent: false })
    }
  })
})

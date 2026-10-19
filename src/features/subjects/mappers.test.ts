import { describe, expect, it } from 'vitest'
import { deadlineToForm, subjectToForm, toDeadlineRow, toSubjectRow } from './mappers'
import { examAtFromDate, localDateOf, nextAssessment, type Assessment } from './model'

const assessment = (patch: Partial<Assessment>): Assessment => ({
  id: crypto.randomUUID(),
  user_id: 'u',
  subject_id: 's',
  kind: 'partial',
  title: 'I parcijala',
  at: examAtFromDate('2026-10-28'),
  format: 'written',
  weight_pct: null,
  scope_all: false,
  passed: false,
  readiness_before: null,
  result_points: null,
  result_max: null,
  contingent: false,
  date_tentative: false,
  created_at: '',
  updated_at: '',
  ...patch,
})

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
      id: 's',
      user_id: 'u',
      name: 'Signali',
      color: 'unknown',
      archived: false,
      priority: 5,
      study_mode: 'campaign',
      campaign_start_on: null,
      created_at: '',
      updated_at: '',
      assessments: [later, earlier],
    })
    expect(form.color).toBe('lavender')
    expect(form.assessments.map((a) => a.title)).toEqual(['I parcijala', 'II parcijala'])
    expect(form.assessments[0]?.dateTentative).toBe(true)
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
    })
    expect(row.est_minutes).toBe(270)
    expect(row.notes).toBeNull()
    const form = deadlineToForm({
      ...row,
      user_id: 'u',
      subject_id: null,
      kind: 'assignment',
      done: false,
      done_minutes: 0,
      notes: null,
      est_minutes: 270,
      created_at: '',
      updated_at: '',
      id: 'd',
    })
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

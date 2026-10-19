import { describe, expect, it } from 'vitest'
import { deadlineFormSchema, subjectFormSchema, type SubjectForm } from './schemas'

const id = () => crypto.randomUUID()

const subject = (patch: Partial<SubjectForm> = {}): SubjectForm => ({
  id: id(),
  name: 'Signali i sistemi',
  color: 'pink',
  priority: 3,
  studyMode: 'regular',
  campaignStartOn: null,
  assessments: [
    {
      id: id(),
      kind: 'partial',
      title: 'I parcijala',
      date: '2026-10-28',
      format: 'written',
      scopeAll: false,
      contingent: false,
      dateTentative: false,
      dateLatest: null,
      examPeriodId: null,
    },
  ],
  ...patch,
})

const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message

describe('subjectFormSchema', () => {
  it('accepts a minimal subject', () => {
    expect(subjectFormSchema.safeParse(subject({ assessments: [] })).success).toBe(true)
  })

  it('trims and requires the name', () => {
    expect(firstError(subjectFormSchema.safeParse(subject({ name: '   ' })))).toBe(
      'validation.required',
    )
    expect(subjectFormSchema.parse(subject({ name: '  Baze  ' })).name).toBe('Baze')
  })

  it('rejects unknown colors and priorities outside 1–5', () => {
    expect(subjectFormSchema.safeParse({ ...subject(), color: 'red' }).success).toBe(false)
    expect(subjectFormSchema.safeParse(subject({ priority: 0 })).success).toBe(false)
    expect(subjectFormSchema.safeParse(subject({ priority: 6 })).success).toBe(false)
  })

  it('allows a manual start only in campaign mode', () => {
    expect(
      subjectFormSchema.safeParse(subject({ studyMode: 'campaign', campaignStartOn: '2026-12-02' }))
        .success,
    ).toBe(true)
    expect(
      firstError(subjectFormSchema.safeParse(subject({ campaignStartOn: '2026-12-02' }))),
    ).toBe('validation.campaignStartOnlyForCampaign')
  })

  it('validates exam dates and tentative flag', () => {
    const bad = subject()
    bad.assessments[0]!.date = '28.10.2026'
    expect(firstError(subjectFormSchema.safeParse(bad))).toBe('validation.date')
  })

  it('requires a valid range for a tentative date', () => {
    const tentative = subject()
    const exam = tentative.assessments[0]!
    exam.dateTentative = true
    expect(firstError(subjectFormSchema.safeParse(tentative))).toBe('validation.rangeEnd')
    exam.dateLatest = '2026-10-20'
    expect(firstError(subjectFormSchema.safeParse(tentative))).toBe('validation.rangeOrder')
    exam.dateLatest = '2026-11-05'
    expect(subjectFormSchema.safeParse(tentative).success).toBe(true)
  })

  it('ignores the range end when the date is confirmed', () => {
    const confirmed = subject()
    confirmed.assessments[0]!.dateLatest = '2026-10-01'
    expect(subjectFormSchema.safeParse(confirmed).success).toBe(true)
  })
})

describe('deadlineFormSchema', () => {
  const deadline = {
    id: id(),
    subjectId: null,
    title: 'Seminarski iz Baza',
    kind: 'assignment' as const,
    date: '2026-10-23',
    estHours: null,
    notes: null,
  }

  it('accepts a deadline without estimate or subject', () => {
    expect(deadlineFormSchema.safeParse(deadline).success).toBe(true)
  })

  it('requires a positive estimate when given', () => {
    expect(deadlineFormSchema.safeParse({ ...deadline, estHours: 0 }).success).toBe(false)
    expect(deadlineFormSchema.safeParse({ ...deadline, estHours: 4.5 }).success).toBe(true)
  })
})

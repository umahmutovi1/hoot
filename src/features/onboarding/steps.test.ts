import { describe, expect, it } from 'vitest'
import { skipsSubjectStep, stepFrom, SUBJECT_STEP } from './steps'

const subject = (over: Partial<Parameters<typeof skipsSubjectStep>[0][number]> = {}) => ({
  archived: false,
  syllabus_literature: null,
  assessments: [],
  ...over,
})

describe('first-subject step', () => {
  it('is skipped once the plan i program or an import gave a subject with an exam', () => {
    expect(skipsSubjectStep([subject({ syllabus_literature: [] })])).toBe(true)
    expect(skipsSubjectStep([subject({ assessments: [{}] })])).toBe(true)
  })

  it('stays for a timetable subject without an exam, an archived one or none', () => {
    expect(skipsSubjectStep([subject()])).toBe(false)
    expect(skipsSubjectStep([subject({ archived: true, assessments: [{}] })])).toBe(false)
    expect(skipsSubjectStep([])).toBe(false)
  })

  it('moves past it both ways', () => {
    expect(stepFrom(SUBJECT_STEP - 1, 1, true)).toBe(SUBJECT_STEP + 1)
    expect(stepFrom(SUBJECT_STEP + 1, -1, true)).toBe(SUBJECT_STEP - 1)
    expect(stepFrom(SUBJECT_STEP - 1, 1, false)).toBe(SUBJECT_STEP)
  })
})

import { describe, expect, it } from 'vitest'
import { toJsonSchema } from './jsonSchema.ts'
import { costUsd } from './prices.ts'
import {
  answerOutputSchema,
  answerRequestSchema,
  autoParseSchema,
  calendarParseSchema,
  documentParseSchema,
  examScheduleParseSchema,
  linkOutputSchema,
  MAX_CUSTOM_PRESETS,
  MAX_DOCUMENT_CHARS,
  parseDocumentRequestSchema,
  questionsParseSchema,
  sessionPresetSchema,
  sessionPresetsSchema,
  tocParseSchema,
} from './schemas.ts'

const outputSchemas = {
  calendarParseSchema,
  examScheduleParseSchema,
  documentParseSchema,
  autoParseSchema,
  answerOutputSchema,
  tocParseSchema,
  questionsParseSchema,
  linkOutputSchema,
}

/** Every object key in a JSON schema, to check structured-output limits. */
function walk(node: unknown, visit: (n: Record<string, unknown>) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit))
  else if (node && typeof node === 'object') {
    visit(node as Record<string, unknown>)
    Object.values(node).forEach((n) => walk(n, visit))
  }
}

describe('structured output schemas', () => {
  for (const [name, schema] of Object.entries(outputSchemas)) {
    it(`${name} is flat: no $ref, no optional properties`, () => {
      const json = toJsonSchema(schema)
      walk(json, (n) => {
        expect(n).not.toHaveProperty('$ref')
        expect(n).not.toHaveProperty('maxLength')
        expect(n).not.toHaveProperty('maxItems')
        if (n.type === 'object' && n.properties) {
          expect(new Set(n.required as string[])).toEqual(new Set(Object.keys(n.properties)))
        }
      })
    })
  }

  it('accepts a typical calendar result', () => {
    const parsed = calendarParseSchema.safeParse({
      title: 'Akademski kalendar 2026/27',
      pages: [],
      warnings: [],
      periods: [
        {
          kind: 'teaching',
          exam_session: null,
          title: 'Zimski semestar',
          starts_on: '2026-10-05',
          ends_on: '2027-01-22',
        },
        {
          kind: 'exam',
          exam_session: 'makeup',
          title: 'Popravni rok',
          starts_on: '2027-02-15',
          ends_on: '2027-02-26',
        },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects malformed dates and times from the model', () => {
    const exam = { subject_name: 'Fizika', subject_id: null, kind: 'partial', number: 2 }
    const ok = examScheduleParseSchema.safeParse({
      title: 'Raspored',
      pages: [],
      warnings: [],
      exams: [{ ...exam, date: '2026-12-03', time: '09:00' }],
    })
    expect(ok.success).toBe(true)
    for (const bad of [
      { date: '3. 12. 2026', time: '09:00' },
      { date: '2026-12-03', time: '9h' },
    ]) {
      const r = examScheduleParseSchema.safeParse({
        title: 'Raspored',
        pages: [],
        warnings: [],
        exams: [{ ...exam, ...bad }],
      })
      expect(r.success).toBe(false)
    }
  })
})

describe('request schemas', () => {
  const base = {
    document_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    kind: 'auto',
    locale: 'bs',
    today: '2026-10-20',
    subjects: [],
  }

  it('needs text or a file', () => {
    expect(parseDocumentRequestSchema.safeParse({ ...base, text: null, file: null }).success).toBe(
      false,
    )
    expect(
      parseDocumentRequestSchema.safeParse({ ...base, text: [{ page: 1, text: 'x' }], file: null })
        .success,
    ).toBe(true)
    expect(
      parseDocumentRequestSchema.safeParse({
        ...base,
        text: null,
        file: { path: 'u/documents/a.pdf', media_type: 'application/pdf' },
      }).success,
    ).toBe(true)
  })

  it('caps the text sent to the model', () => {
    const long = [{ page: 1, text: 'x'.repeat(MAX_DOCUMENT_CHARS + 1) }]
    expect(parseDocumentRequestSchema.safeParse({ ...base, text: long, file: null }).success).toBe(
      false,
    )
  })

  it('keeps at most 6 history messages for a question', () => {
    const history = Array.from({ length: 7 }, () => ({ role: 'user', text: 'a' }))
    const r = answerRequestSchema.safeParse({
      question: 'Kad je popravni?',
      history,
      state: '{}',
      locale: 'bs',
      today: '2026-10-20',
    })
    expect(r.success).toBe(false)
  })
})

describe('costUsd', () => {
  it('prices known models and returns null for unknown ones', () => {
    expect(costUsd('claude-haiku-5-5', 1_000_000, 1_000_000)).toBeCloseTo(0.6, 6)
    expect(costUsd('gemini-2.5-flash', 3000, 1500)).toBeCloseTo(0.00465, 6)
    expect(costUsd('mystery', 1, 1)).toBeNull()
  })
})

describe('sessionPresetSchema', () => {
  const base = {
    id: 'custom:00000000-0000-4000-8000-000000000001',
    name: 'Moj niz',
    steps: [
      { kind: 'work', min: 45 },
      { kind: 'break', min: 10 },
    ],
    long_break: null,
  }

  it('accepts alternating study and break steps', () => {
    expect(sessionPresetSchema.safeParse(base).success).toBe(true)
    expect(
      sessionPresetSchema.safeParse({ ...base, long_break: { every: 4, min: 20 } }).success,
    ).toBe(true)
  })

  it('rejects a sequence that starts with a break, ends without one or repeats a kind', () => {
    const bad = (steps: { kind: string; min: number }[]) =>
      sessionPresetSchema.safeParse({ ...base, steps }).success
    expect(
      bad([
        { kind: 'break', min: 5 },
        { kind: 'work', min: 25 },
      ]),
    ).toBe(false)
    expect(
      bad([
        { kind: 'work', min: 25 },
        { kind: 'break', min: 5 },
        { kind: 'work', min: 25 },
      ]),
    ).toBe(false)
    expect(
      bad([
        { kind: 'work', min: 25 },
        { kind: 'work', min: 25 },
      ]),
    ).toBe(false)
  })

  it('rejects ids that are not custom ones, and too many presets', () => {
    expect(sessionPresetSchema.safeParse({ ...base, id: 'standard' }).success).toBe(false)
    expect(sessionPresetsSchema.safeParse(Array(MAX_CUSTOM_PRESETS + 1).fill(base)).success).toBe(
      false,
    )
  })
})

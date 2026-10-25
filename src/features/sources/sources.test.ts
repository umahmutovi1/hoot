import { describe, expect, it } from 'vitest'
import { mergeOutline } from '@/lib/outline/merge'
import { parseOutline } from '@/lib/outline/parse'
import { carryDifficulty, sourceToForm, toSourceRow, toStoredUnits, toUnitRows } from './mappers'
import {
  examProgress,
  levelsFor,
  materialOf,
  relatedUnits,
  shortExamLabel,
  toScopeRows,
  type SourceWithUnits,
  type Unit,
} from './model'
import { cardFormSchema, sourceFormSchema, unitFormSchema } from './schemas'

const ID = '7f1c2b4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'
const SUBJECT = '2b1c2b4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'

const unit = (id: string, extra: Partial<Unit> = {}): Unit => ({
  id,
  user_id: 'u',
  source_id: 's',
  parent_id: null,
  kind: 'chapter',
  position: 0,
  label: id,
  title: id,
  page_start: null,
  page_end: null,
  amount: 10,
  ai_difficulty: null,
  user_difficulty: null,
  est_minutes: null,
  level: 0,
  confidence: null,
  notes: null,
  answer: null,
  answer_origin: null,
  completed_at: null,
  fsrs_stability: null,
  fsrs_difficulty: null,
  fsrs_state: null,
  fsrs_reps: 0,
  fsrs_lapses: 0,
  review_streak: 0,
  read_amount: null,
  last_review_at: null,
  next_review_on: null,
  archived_at: null,
  created_at: '',
  updated_at: '',
  ...extra,
})

const source = (units: Unit[], extra: Partial<SourceWithUnits> = {}): SourceWithUnits => ({
  id: 's',
  user_id: 'u',
  archived_at: null,
  subject_id: SUBJECT,
  kind: 'book',
  title: 'Oppenheim',
  author: null,
  weight: null,
  measure: 'pages',
  base_min_per_unit: 4,
  learned_min_per_unit: null,
  learned_samples: 0,
  measured_sessions: 0,
  is_rough: false,
  file_name: null,
  drive_file_id: null,
  external_url: null,
  created_at: '',
  updated_at: '',
  units,
  ...extra,
})

describe('source form', () => {
  const form = {
    id: ID,
    subjectId: SUBJECT,
    kind: 'other' as const,
    title: 'Zbirka',
    measure: 'items' as const,
    minutesPerItem: 40,
  }

  it('items need minutes per item', () => {
    expect(sourceFormSchema.safeParse(form).success).toBe(true)
    expect(sourceFormSchema.safeParse({ ...form, minutesPerItem: null }).success).toBe(false)
  })

  it('stores the user minutes for items and the heuristic otherwise', () => {
    expect(toSourceRow(form).base_min_per_unit).toBe(40)
    expect(toSourceRow({ ...form, measure: 'pages', minutesPerItem: null }).base_min_per_unit).toBe(
      4,
    )
    expect(toSourceRow({ ...form, kind: 'script', measure: 'pages' }).base_min_per_unit).toBe(6)
  })

  it('round-trips through the row', () => {
    const row = { ...source([]), ...toSourceRow(form) } as SourceWithUnits
    expect(sourceToForm(row)).toEqual(form)
  })
})

describe('unit and card forms', () => {
  it('rejects a reversed page range', () => {
    expect(
      unitFormSchema.safeParse({ label: '1', title: 'A', pageStart: 9, pageEnd: 3 }).success,
    ).toBe(false)
    expect(
      unitFormSchema.safeParse({ label: '1', title: 'A', pageStart: 3, pageEnd: null }).success,
    ).toBe(true)
  })

  it('cards need both sides', () => {
    expect(cardFormSchema.safeParse({ id: ID, unitId: ID, front: 'Q', back: '' }).success).toBe(
      false,
    )
  })
})

describe('outline → rows', () => {
  it('questions become question units; difficulty is rounded', () => {
    const parsed = parseOutline('1 Prvo\n2 Drugo', 'questions').units
    parsed[0]!.difficulty = 4
    let n = 0
    const merged = mergeOutline([], parsed, () => `id${++n}`)
    const rows = toUnitRows('s', 'questions', merged.units)
    expect(rows.map((r) => [r.id, r.kind, r.label, r.position, r.ai_difficulty])).toEqual([
      ['id1', 'question', 'P1', 0, 4],
      ['id2', 'question', 'P2', 1, null],
    ])
  })

  it('re-entered text keeps the stored difficulty by label', () => {
    const existing = [unit('a', { label: '1', ai_difficulty: 5 })]
    const parsed = carryDifficulty(parseOutline('1 A\n2 B', 'items').units, existing)
    expect(parsed.map((u) => u.difficulty)).toEqual([5, null])
    const merged = mergeOutline(toStoredUnits(existing), parsed, () => 'new')
    expect(merged.units[0]).toMatchObject({ id: 'a', difficulty: 5 })
  })
})

describe('materialOf', () => {
  it('estimates minutes and weighs progress by them', () => {
    const m = materialOf(
      source([
        unit('a', { amount: 10, level: 3, ai_difficulty: 3 }),
        unit('b', { amount: 30, level: 0, ai_difficulty: 3, position: 1 }),
      ]),
    )
    expect(m.units.map((u) => u.minutes)).toEqual([40, 120])
    expect(m.progress.fraction).toBeCloseTo(0.25)
  })

  it('ignores archived units and the children of archived parents', () => {
    const m = materialOf(
      source([
        unit('a', { archived_at: '2026-10-01' }),
        unit('a1', { parent_id: 'a', level: 3 }),
        unit('b'),
      ]),
    )
    expect(m.units.map((u) => u.id)).toEqual(['b'])
  })

  it('a parent counts through its children only', () => {
    const m = materialOf(
      source([
        unit('p', { amount: 100 }),
        unit('c1', { parent_id: 'p', level: 3, position: 1 }),
        unit('c2', { parent_id: 'p', position: 2 }),
      ]),
    )
    expect(m.progress.totalMinutes).toBe(80)
    expect(m.progress.fraction).toBeCloseTo(0.5)
  })
})

describe('examProgress', () => {
  it('uses only the units in the exam scope', () => {
    const m = materialOf(source([unit('a', { level: 3 }), unit('b', { position: 1 })]))
    const rows = toScopeRows([
      { user_id: 'u', assessment_id: 'I', unit_id: 'a', assigned_by: 'user', included: true },
    ])
    expect(examProgress({ id: 'I', scope_all: false }, [m], rows).fraction).toBe(1)
    expect(examProgress({ id: 'F', scope_all: true }, [m], rows).fraction).toBeCloseTo(0.5)
  })
})

describe('levelsFor', () => {
  it('questions skip "understood"', () => {
    expect(levelsFor('question')).toEqual([0, 1, 3])
    expect(levelsFor('chapter')).toEqual([0, 1, 2, 3])
  })
})

describe('relatedUnits', () => {
  const link = (unit_id: string, topic_id: string) => ({
    user_id: 'u',
    unit_id,
    topic_id,
    assigned_by: 'user' as const,
  })
  const topic = (id: string, links: ReturnType<typeof link>[]) => ({
    id,
    user_id: 'u',
    subject_id: SUBJECT,
    name: id,
    unit_topics: links,
  })

  it('links chapters and questions through shared topics', () => {
    const ch = unit('ch')
    const q1 = unit('q1', { kind: 'question' })
    const q2 = unit('q2', { kind: 'question' })
    const other = unit('ch2')
    const topics = [
      topic('t1', [link('ch', 't1'), link('q1', 't1'), link('ch2', 't1')]),
      topic('t2', [link('q2', 't2')]),
    ]
    expect(relatedUnits(ch, topics, [ch, q1, q2, other]).map((u) => u.id)).toEqual(['q1'])
    expect(relatedUnits(q1, topics, [ch, q1, q2, other]).map((u) => u.id)).toEqual(['ch', 'ch2'])
  })
})

describe('shortExamLabel', () => {
  it('keeps roman numerals of partial exams', () => {
    expect(['I parcijala', 'II parcijala', 'Završni', 'IV kolokvij'].map(shortExamLabel)).toEqual([
      'I',
      'II',
      'Završni',
      'IV',
    ])
  })
})

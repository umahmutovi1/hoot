import { describe, expect, it } from 'vitest'
import type { Unit } from '@/features/sources/model'
import { NO_MEMORY } from '@/features/sources/model'
import { dueUnits, type CardDue } from './due'
import { memoryColumns, memoryOf } from './memory'

const boundary = { timeZone: 'Europe/Sarajevo', dayStartMin: 240 }
const TODAY = '2026-10-22'

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
  amount: 1,
  ai_difficulty: null,
  user_difficulty: null,
  est_minutes: 60,
  level: 1,
  confidence: null,
  notes: null,
  answer: null,
  answer_origin: null,
  completed_at: null,
  ...NO_MEMORY,
  next_review_on: null,
  archived_at: null,
  created_at: '',
  updated_at: '',
  ...extra,
})

const card = (id: string, unitId: string, on: string | null): CardDue => ({
  id,
  unit_id: unitId,
  next_review_on: on,
  ...NO_MEMORY,
})

describe('memory', () => {
  it('reads nothing before the first test and round-trips the columns', () => {
    expect(memoryOf(unit('a'), boundary)).toBeNull()
    const m = {
      stability: 4.2,
      difficulty: 6,
      state: 2,
      reps: 3,
      lapses: 1,
      lastReviewOn: '2026-10-21',
      streak: 2,
    }
    // 01:30 on the 22nd belongs to the 21st (day starts at 04:00)
    const cols = memoryColumns(m, '2026-10-21T23:30:00.000Z')
    expect(memoryOf(unit('a', cols), boundary)).toEqual(m)
  })
})

describe('dueUnits', () => {
  it('units due themselves or through a card, weakest first', () => {
    const strong = unit('strong', {
      level: 2,
      next_review_on: TODAY,
      ...memoryColumns(
        {
          stability: 30,
          difficulty: 5,
          state: 2,
          reps: 2,
          lapses: 0,
          lastReviewOn: '2026-10-20',
          streak: 2,
        },
        '2026-10-20T10:00:00Z',
      ),
    })
    const read = unit('read', { next_review_on: '2026-10-21' })
    const later = unit('later', { next_review_on: '2026-10-30' })
    const notStarted = unit('new', { level: 0, next_review_on: TODAY })
    const archived = unit('old', { next_review_on: TODAY, archived_at: 'x' })
    const viaCard = unit('card', { level: 0 })
    const out = dueUnits(
      [strong, read, later, notStarted, archived, viaCard],
      [card('c1', 'card', TODAY), card('c2', 'later', '2026-11-01'), card('c3', 'card', null)],
      TODAY,
      boundary,
    )
    expect(out.map((d) => [d.unit.id, d.unitDue, d.cardIds])).toEqual([
      ['card', false, ['c1']],
      ['read', true, []],
      ['strong', true, []],
    ])
    expect(out[2]!.strength).toBeGreaterThan(0.9)
  })
})

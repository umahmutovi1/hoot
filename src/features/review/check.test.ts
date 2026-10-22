import { describe, expect, it } from 'vitest'
import type { Outcome } from './apply'
import { checkItems, checkReviews, checkSummary } from './check'
import { card, unit } from './fixtures'

const TODAY = '2026-10-22'
const withNotes = unit('n', { level: 2, notes: 'ključno', next_review_on: TODAY })
const withQuestion = unit('w', { level: 2, notes: 'x', next_review_on: TODAY })
const bare = unit('b', { level: 1, next_review_on: TODAY })
const notStarted = unit('z', { level: 0 })
const q = unit('q', { kind: 'question', title: 'Šta je BCNF?', answer: 'Stroža 3NF' })
const qNoAnswer = unit('q0', { kind: 'question', title: 'Bez odgovora' })
const dueCard = { ...card('c', 'n'), next_review_on: TODAY }
const laterCard = { ...card('c2', 'n'), next_review_on: '2026-11-01' }

const questionsOf = (u: { id: string }) => (u.id === 'w' ? [qNoAnswer, q] : [])

describe('checkItems', () => {
  it('asks each chapter through its most precise test, plus due cards', () => {
    const items = checkItems(
      [withNotes, withQuestion, bare, notStarted, q],
      [dueCard, laterCard],
      questionsOf,
      TODAY,
    )
    expect(items.map((i) => [i.key, i.source, i.prompt, i.answer])).toEqual([
      ['u:n', 'notes', withNotes.title, 'ključno'],
      ['c:c', 'card', 'f', 'b'],
      ['u:w', 'exam_question', 'Šta je BCNF?', 'Stroža 3NF'],
      ['u:b', 'recall', bare.title, null],
      ['u:q', 'question', 'Šta je BCNF?', 'Stroža 3NF'],
    ])
  })
})

describe('checkReviews', () => {
  it('rates the unit, the question asked for it (once) and cards', () => {
    const items = checkItems([withNotes, withQuestion, bare], [dueCard], questionsOf, TODAY)
    const r = checkReviews(items, { 'u:n': 2, 'c:c': 1, 'u:w': 0, 'u:b': 1 })
    expect(r.units.map((u) => [u.unit.id, u.recalls[0]!.source, u.recalls[0]!.recall])).toEqual([
      ['n', 'notes', 2],
      ['w', 'exam_question', 0],
      ['q', 'exam_question', 0],
      ['b', 'blurt', 1],
    ])
    expect(r.cards.map((c) => [c.card.id, c.recall])).toEqual([['c', 1]])
  })
})

describe('checkSummary', () => {
  it('counts ratings and lists the change per unit', () => {
    const items = checkItems([withNotes, bare], [dueCard], questionsOf, TODAY)
    const outcome = (o: Partial<Outcome>): Outcome => ({
      id: 'n',
      kind: 'unit',
      unitId: 'n',
      recall: 2,
      levelBefore: 2,
      levelAfter: 2,
      strengthBefore: 0.64,
      strengthAfter: 0.93,
      nextReviewOn: '2026-10-25',
      relearn: false,
      ...o,
    })
    const s = checkSummary(
      items,
      { 'u:n': 2, 'c:c': 1, 'u:b': 0 },
      [
        outcome({}),
        outcome({
          id: 'c',
          kind: 'card',
          recall: 1,
          strengthBefore: null,
          nextReviewOn: '2026-10-24',
        }),
        outcome({
          id: 'b',
          unitId: 'b',
          recall: 0,
          levelBefore: 1,
          levelAfter: 1,
          strengthBefore: null,
          strengthAfter: 0.5,
          nextReviewOn: null,
          relearn: true,
        }),
      ],
      TODAY,
    )
    expect([s.count, s.remembered, s.partly, s.forgot]).toEqual([3, 1, 1, 1])
    expect(s.changes.map((c) => [c.unit.id, c.before, c.after, c.relearn, c.nextInDays])).toEqual([
      ['n', 0.64, 0.93, false, 3],
      ['b', null, 0.5, true, null],
    ])
    expect(s.relearn.map((u) => u.id)).toEqual(['b'])
  })
})

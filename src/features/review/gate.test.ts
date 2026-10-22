import { describe, expect, it } from 'vitest'
import { card, unit } from './fixtures'
import {
  EMPTY_ANSWERS,
  answered,
  blurtClock,
  gateItems,
  gateReviews,
  gateTargets,
  linkedQuestions,
} from './gate'

const parent = unit('p', { title: '5.1 Funkcionalne zavisnosti', label: '5.1', level: 0 })
const a = unit('a', { parent_id: 'p', title: '5.1.1 Armstrong', notes: 'X → Y' })
const b = unit('b', { parent_id: 'p', title: '5.1.2 Zatvorenje' })
const c = unit('c', { title: '5.2 Normalne forme' })
const q1 = unit('q1', { kind: 'question', title: 'Razlika 3NF i BCNF?', answer: 'BCNF je stroža' })
const q2 = unit('q2', { kind: 'question', title: 'Šta je ključ?', position: 1 })

describe('gateTargets', () => {
  it('groups read leaves of one parent into a test with subheadings', () => {
    const t = gateTargets([a, b, c], [parent, a, b, c])
    expect(t.map((x) => [x.key, x.leaves.map((l) => l.id)])).toEqual([
      ['p', ['a', 'b']],
      ['c', ['c']],
    ])
    expect(t[0]!.title).toBe('5.1 Funkcionalne zavisnosti')
  })
  it('a single read leaf of a parent is its own test', () => {
    expect(gateTargets([a], [parent, a, b]).map((x) => x.key)).toEqual(['a'])
  })
})

describe('gateItems and linkedQuestions', () => {
  it('offers only what exists', () => {
    const [target] = gateTargets([a, b], [parent, a, b])
    const links = [
      { unit_id: 'a', topic_id: 't1' },
      { unit_id: 'q1', topic_id: 't1' },
      { unit_id: 'q2', topic_id: 't2' },
    ]
    const qs = linkedQuestions(target!, links, [a, b, q1, q2])
    expect(qs.map((q) => q.id)).toEqual(['q1'])
    const items = gateItems(target!, qs, [card('k', 'b'), card('other', 'c')])
    expect(items.exam_question).toEqual([
      {
        key: 'q:q1',
        source: 'exam_question',
        prompt: 'Razlika 3NF i BCNF?',
        answer: 'BCNF je stroža',
        refId: 'q1',
      },
    ])
    expect(items.notes.map((i) => i.refId)).toEqual(['a'])
    expect(items.card.map((i) => i.refId)).toEqual(['k'])
  })
})

describe('gateReviews', () => {
  const [target] = gateTargets([a, b], [parent, a, b])

  it('nothing rated → nothing to save', () => {
    expect(answered(target!, EMPTY_ANSWERS)).toBe(false)
    expect(gateReviews(target!, EMPTY_ANSWERS, [q1], [])).toEqual({ units: [], cards: [] })
  })

  it('questions and blurting rate every leaf; notes, cards and subheadings their own', () => {
    const k = card('k', 'b')
    const r = gateReviews(
      target!,
      { ratings: { 'q:q1': 2, 'n:a': 1, 'c:k': 0 }, explained: { a: true, b: false }, blurt: 2 },
      [q1],
      [k],
    )
    const recalls = (id: string) =>
      r.units.find((u) => u.unit.id === id)!.recalls.map((x) => `${x.source}:${x.recall}`)
    expect(recalls('a')).toEqual(['exam_question:2', 'blurt:2', 'notes:1', 'outline:2'])
    expect(recalls('b')).toEqual(['exam_question:2', 'blurt:2', 'card:0', 'outline:0'])
    expect(recalls('q1')).toEqual(['exam_question:2'])
    expect(r.cards).toEqual([{ card: k, unit: b, recall: 0 }])
    expect(answered(target!, { ...EMPTY_ANSWERS, explained: { a: false } })).toBe(true)
  })
})

describe('blurtClock', () => {
  it('counts down from 4:00 and stops at 0:00', () => {
    expect(blurtClock(0, 0)).toBe('4:00')
    expect(blurtClock(0, 18_500)).toBe('3:42')
    expect(blurtClock(0, 10 * 60_000)).toBe('0:00')
  })
})

import { describe, expect, it } from 'vitest'
import { parseOutline } from '@/lib/outline/parse'
import { cycleDifficulty, nextLabel, removeUnit, reparse, upsertUnit } from './outlineEdit'

const units = () => parseOutline('1 A 1\n1.1 A1 2\n1.2 A2 5\n2 B 10-20', 'pages').units
const labels = (u: { label: string }[]) => u.map((x) => x.label)

describe('review list edits', () => {
  it('reparse keeps difficulty by label', () => {
    const list = units()
    list[3]!.difficulty = 5
    expect(reparse(list, 'pages').units[3]!.difficulty).toBe(5)
  })

  it('removing a unit removes its sub-units and re-derives end pages', () => {
    const out = removeUnit(units(), '1.2', 'pages')
    expect(labels(out.units)).toEqual(['1', '1.1', '2'])
    expect(out.units[1]).toMatchObject({ pageStart: 2, pageEnd: 9 })
    expect(labels(removeUnit(units(), '1', 'pages').units)).toEqual(['2'])
  })

  it('inserts a sub-unit after its siblings', () => {
    const out = upsertUnit(
      units(),
      { label: '1.3', title: 'A3', pageStart: 7, pageEnd: null },
      null,
      'pages',
    )
    expect(labels(out.units)).toEqual(['1', '1.1', '1.2', '1.3', '2'])
    expect(out.units[3]).toMatchObject({ parentLabel: '1', pageEnd: 9 })
  })

  it('appends a top-level unit and edits one in place', () => {
    const added = upsertUnit(
      units(),
      { label: '3', title: 'C', pageStart: 21, pageEnd: 30 },
      null,
      'pages',
    )
    expect(labels(added.units)).toEqual(['1', '1.1', '1.2', '2', '3'])
    const edited = upsertUnit(
      added.units,
      { label: '3', title: 'Cc', pageStart: 21, pageEnd: 25 },
      '3',
      'pages',
    )
    expect(edited.units[4]).toMatchObject({ title: 'Cc', amount: 5 })
  })

  it('suggests the next label', () => {
    expect(nextLabel(units(), 'pages')).toBe('3')
    expect(nextLabel(parseOutline('P4 x', 'questions').units, 'questions')).toBe('P5')
    expect(nextLabel([], 'items')).toBe('1')
  })

  it('cycles difficulty 1–5', () => {
    expect([null, 1, 4, 5].map(cycleDifficulty)).toEqual([4, 2, 5, 1])
  })
})

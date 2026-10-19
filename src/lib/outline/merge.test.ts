import { describe, expect, it } from 'vitest'
import { mergeOutline, type StoredUnit } from './merge'
import { parseOutline } from './parse'

const stored = (id: string, label: string, extra: Partial<StoredUnit> = {}): StoredUnit => ({
  id,
  label,
  title: `T${label}`,
  parentId: null,
  pageStart: null,
  pageEnd: null,
  amount: 1,
  difficulty: null,
  archived: false,
  ...extra,
})

const ids = () => {
  let n = 0
  return () => `new-${++n}`
}

describe('mergeOutline', () => {
  it('keeps ids by label, adds new ones and archives missing', () => {
    const existing = [stored('a', '1'), stored('b', '2'), stored('c', '3')]
    const incoming = parseOutline('1 T1\n2 Renamed\n4 T4', 'items').units
    const { units, archive } = mergeOutline(existing, incoming, ids())
    expect(units.map((u) => [u.id, u.label, u.status, u.position])).toEqual([
      ['a', '1', 'unchanged', 0],
      ['b', '2', 'changed', 1],
      ['new-1', '4', 'new', 2],
    ])
    expect(archive.map((u) => u.id)).toEqual(['c'])
  })

  it('restores an archived unit whose label comes back', () => {
    const existing = [stored('a', '1', { archived: true })]
    const { units, archive } = mergeOutline(existing, parseOutline('1 T1', 'items').units, ids())
    expect(units[0]).toMatchObject({ id: 'a', status: 'restored' })
    expect(archive).toEqual([])
  })

  it('does not archive already archived units again', () => {
    const existing = [stored('a', '1', { archived: true })]
    expect(mergeOutline(existing, [], ids()).archive).toEqual([])
  })

  it('links sub-units to parent ids, old or new', () => {
    const existing = [stored('a', '1')]
    const incoming = parseOutline('1 T1\n1.1 Child\n2 T2\n2.1 Child', 'items').units
    const { units } = mergeOutline(existing, incoming, ids())
    expect(units.map((u) => [u.label, u.parentId])).toEqual([
      ['1', null],
      ['1.1', 'a'],
      ['2', null],
      ['2.1', 'new-2'],
    ])
  })

  it('marks a moved unit as changed', () => {
    const existing = [stored('a', '1'), stored('b', '1.1', { title: 'T1.1', parentId: null })]
    const { units } = mergeOutline(existing, parseOutline('1 T1\n1.1 T1.1', 'items').units, ids())
    expect(units[1]).toMatchObject({ id: 'b', parentId: 'a', status: 'changed' })
  })
})

import { describe, expect, it } from 'vitest'
import { fromAi, withRatings } from './ai'

describe('fromAi', () => {
  it('builds the outline with derived end pages, difficulty and topics', () => {
    const { outline, topics } = fromAi(
      [
        { label: '1', title: 'Uvod', page_start: 1, ai_difficulty: 2, topics: ['Signali'] },
        { label: '1.1', title: 'Signali', page_start: 1, ai_difficulty: 2, topics: [] },
        { label: '2', title: 'LTI sistemi', page_start: 74, ai_difficulty: 4, topics: ['LTI'] },
        { label: '2.1', title: 'Konvolucija', page_start: 75, page_end: 90, topics: [] },
      ],
      'pages',
    )
    const by = Object.fromEntries(outline.units.map((u) => [u.label, u]))
    expect(by['1.1']!.parentLabel).toBe('1')
    expect(by['1']!.pageEnd).toBe(73)
    expect(by['2.1']!.pageEnd).toBe(90)
    expect(by['2']!.difficulty).toBe(4)
    expect(by['2.1']!.difficulty).toBeNull()
    expect(topics['2']).toEqual(['LTI'])
  })

  it('numbers labels the parser would not read', () => {
    const { outline } = fromAi(
      [
        { label: 'Uvod', title: 'Uvod', page_start: null, topics: [] },
        { label: 'A', title: 'Dodatak', page_start: null, topics: [] },
      ],
      'pages',
    )
    expect(outline.units.map((u) => u.label)).toEqual(['1', '2'])
  })

  it('gives slides a range instead of a count', () => {
    const { outline } = fromAi(
      [
        { label: '1', title: 'Uvod', page_start: 1, topics: [] },
        { label: '2', title: 'Konvolucija', page_start: 21, topics: [] },
      ],
      'slides',
    )
    expect(outline.units.map((u) => [u.pageStart, u.pageEnd, u.amount])).toEqual([
      [1, 20, 20],
      [21, 21, 1],
    ])
  })

  it('reads questions with P labels', () => {
    const { outline, topics } = fromAi(
      [{ label: 'P8', title: 'Objasni 3NF i BCNF.', topics: ['3NF'] }],
      'questions',
    )
    expect(outline.units[0]).toMatchObject({ label: 'P8', title: 'Objasni 3NF i BCNF' })
    expect(topics.P8).toEqual(['3NF'])
  })
})

describe('withRatings', () => {
  it('sets difficulty and topics by label', () => {
    const { outline } = fromAi([{ label: '1', title: 'Uvod', page_start: 1, topics: [] }], 'pages')
    const rated = withRatings(outline, [
      { label: '1', title: 'Uvod', ai_difficulty: 5, topics: ['X'] },
    ])
    expect(rated.outline.units[0]!.difficulty).toBe(5)
    expect(rated.topics['1']).toEqual(['X'])
  })
})

import { describe, expect, it } from 'vitest'
import { suggestScope, type SuggestInput } from './scopeSuggest'

const book = (minutes: number[]) => ({
  kind: 'chapters' as const,
  units: minutes.map((m, i) => ({ id: `c${i + 1}`, minutes: m })),
})

const base = (over: Partial<SuggestInput> = {}): SuggestInput => ({
  partialIds: ['I', 'II'],
  hasWholeExam: true,
  sources: [book([60, 60, 60, 60])],
  chaptersOf: new Map(),
  assigned: new Set(),
  ...over,
})

const exams = (out: ReturnType<typeof suggestScope>, id: string) => {
  const c = out.get(id)
  return c?.kind === 'exams' ? c.examIds : null
}

describe('suggestScope', () => {
  it('splits chapters in order by minutes', () => {
    const out = suggestScope(base({ sources: [book([30, 30, 190, 70])] }))
    expect(['c1', 'c2', 'c3', 'c4'].map((id) => exams(out, id))).toEqual([
      ['I'],
      ['I'],
      ['I'],
      ['II'],
    ])
  })

  it('leaves the second half to the whole-material exam with one partial', () => {
    const out = suggestScope(base({ partialIds: ['I'] }))
    expect(exams(out, 'c1')).toEqual(['I'])
    expect(exams(out, 'c2')).toEqual(['I'])
    expect(out.has('c3')).toBe(false)
  })

  it('questions follow their chapters, across partials when linked to both', () => {
    const out = suggestScope(
      base({
        sources: [
          book([60, 60, 60, 60]),
          {
            kind: 'questions',
            units: [
              { id: 'q1', minutes: 8 },
              { id: 'q2', minutes: 8 },
              { id: 'q3', minutes: 8 },
            ],
          },
        ],
        chaptersOf: new Map([
          ['q1', new Set(['c1'])],
          ['q2', new Set(['c2', 'c4'])],
        ]),
      }),
    )
    expect(exams(out, 'q1')).toEqual(['I'])
    expect(exams(out, 'q2')).toEqual(['I', 'II'])
    expect(out.has('q3')).toBe(false)
  })

  it('never suggests for assigned units and does nothing without partials', () => {
    expect(suggestScope(base({ assigned: new Set(['c1']) })).has('c1')).toBe(false)
    expect(suggestScope(base({ partialIds: [] })).size).toBe(0)
  })
})

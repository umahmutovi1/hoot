import { describe, expect, it } from 'vitest'
import { addDays, format } from 'date-fns'
import bs from '@/locales/bs.json'
import en from '@/locales/en.json'
import { FACTS, factOfDay } from './facts'

const day = (offset: number) => format(addDays(new Date(2026, 9, 19), offset), 'yyyy-MM-dd')

describe('factOfDay', () => {
  it('is stable within a day', () => {
    expect(factOfDay('2026-10-19')).toBe(factOfDay('2026-10-19'))
  })

  it('shows every fact once before repeating', () => {
    const ids = Array.from({ length: FACTS.length }, (_, i) => factOfDay(day(i)).id)
    expect(new Set(ids).size).toBe(FACTS.length)
    expect(factOfDay(day(FACTS.length)).id).toBe(ids[0])
  })

  it('changes from one day to the next', () => {
    expect(factOfDay(day(0)).id).not.toBe(factOfDay(day(1)).id)
  })
})

describe('facts', () => {
  it('every fact has text in both languages and an https source', () => {
    for (const f of FACTS) {
      expect(bs.facts[f.id]).toBeTruthy()
      expect(en.facts[f.id]).toBeTruthy()
      expect(f.url).toMatch(/^https:\/\//)
    }
  })

  it('ids are unique', () => {
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length)
  })
})

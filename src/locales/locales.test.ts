import { describe, expect, it } from 'vitest'
import bs from './bs.json'
import en from './en.json'

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

describe('locale files', () => {
  it('bs and en have the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(bs).sort())
  })

  it('has no empty strings', () => {
    for (const file of [bs, en]) {
      const empty = keys(file).filter((k) => {
        const v = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], file)
        return typeof v === 'string' && v.trim() === ''
      })
      expect(empty).toEqual([])
    }
  })
})

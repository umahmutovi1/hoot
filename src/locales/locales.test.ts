import { describe, expect, it } from 'vitest'
import bs from './bs.json'
import en from './en.json'

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

// Plural forms differ per language (bs has one/few/other, en one/other), so compare base keys.
const PLURAL = /_(zero|one|two|few|many|other)$/
const baseKeys = (file: unknown) =>
  [...new Set(keys(file).map((k) => k.replace(PLURAL, '')))].sort()

describe('locale files', () => {
  it('bs and en have the same keys', () => {
    expect(baseKeys(en)).toEqual(baseKeys(bs))
  })

  it('every plural key has an _other form', () => {
    for (const file of [bs, en]) {
      const all = new Set(keys(file))
      const plurals = keys(file).filter((k) => PLURAL.test(k))
      for (const k of plurals) expect(all.has(k.replace(PLURAL, '_other'))).toBe(true)
    }
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

import { describe, expect, it } from 'vitest'
import { availableChain, BUSY_SKIP_MS, exhausted, nextReset, parseChain } from './chain.ts'

describe('parseChain', () => {
  it('reads provider:model pairs, keeps the model colons and drops unknown providers', () => {
    expect(
      parseChain('gemini:gemini-2.5-flash, groq:llama-3.3-70b, openrouter:meta/llama:free, x:y'),
    ).toEqual([
      { provider: 'gemini', model: 'gemini-2.5-flash' },
      { provider: 'groq', model: 'llama-3.3-70b' },
      { provider: 'openrouter', model: 'meta/llama:free' },
    ])
    expect(parseChain(undefined)).toEqual([])
  })
})

describe('nextReset', () => {
  it('Gemini resets at midnight Pacific, the others at midnight UTC', () => {
    // 1 Nov 2026 10:00 UTC = 03:00 PDT; next Pacific midnight = 2 Nov 08:00 UTC (PST from 1 Nov).
    const at = new Date('2026-11-01T10:00:00Z')
    expect(nextReset('groq', at).toISOString()).toBe('2026-11-02T00:00:00.000Z')
    const g = nextReset('gemini', at)
    expect(g > at).toBe(true)
    expect(g.getTime() - at.getTime()).toBeLessThanOrEqual(24 * 3600_000)
    expect([7, 8]).toContain(g.getUTCHours())
  })
})

describe('exhausted / availableChain', () => {
  const chain = parseChain('gemini:gemini-2.5-flash,gemini:gemini-3.5-flash-lite,groq:llama')
  const now = new Date('2026-11-01T12:00:00Z')

  it('a quota error skips the model until its reset, a busy one for a minute', () => {
    const runs = [
      {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        error: 'quota_exhausted: day',
        created_at: '2026-11-01T11:00:00Z',
      },
      {
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite',
        error: 'provider_busy: 429',
        created_at: '2026-11-01T11:59:30Z',
      },
    ]
    expect(exhausted(runs).get('gemini:gemini-2.5-flash')! > now).toBe(true)
    expect(availableChain(chain, runs, now)).toEqual([])
    const later = new Date(now.getTime() + BUSY_SKIP_MS)
    expect(availableChain(chain, runs, later)).toEqual([
      { provider: 'gemini', model: 'gemini-3.5-flash-lite' },
    ])
  })

  it('leaves out models that have not passed the eval', () => {
    expect(availableChain(chain, [], now).map((e) => e.model)).toEqual([
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
    ])
  })

  it('other failures do not exhaust a model', () => {
    const runs = [
      {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        error: 'invalid_output: x',
        created_at: '2026-11-01T11:59:00Z',
      },
    ]
    expect(exhausted(runs).size).toBe(0)
  })
})

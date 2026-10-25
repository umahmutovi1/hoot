import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  DAILY_AI_LIMIT,
  generate,
  getProvider,
  isAiConfigured,
  jsonFromText,
  LlmError,
} from './llm.ts'
import type { AiRunLog, LlmDeps, LlmProvider, LlmRawResult } from './llm.ts'

const schema = z.object({ answer: z.string() })

function fakeProvider(results: (LlmRawResult | Error)[]): LlmProvider {
  const queue = [...results]
  return {
    name: 'gemini',
    model: 'gemini-2.5-flash',
    generate: vi.fn(async () => {
      const next = queue.shift()
      if (!next) throw new Error('no more results')
      if (next instanceof Error) throw next
      return next
    }),
  }
}

function deps(provider: LlmProvider, used = 0) {
  const runs: AiRunLog[] = []
  const d: LlmDeps = {
    provider,
    countRecentRuns: async () => used,
    logRun: async (run) => {
      runs.push(run)
    },
  }
  return { d, runs }
}

const req = { task: 'answer' as const, system: 's', text: 't', schema, maxTokens: 100 }

describe('generate', () => {
  it('returns validated data and logs one ok run with cost', async () => {
    const provider = fakeProvider([
      { json: { answer: 'hi' }, inputTokens: 1000, outputTokens: 200 },
    ])
    const { d, runs } = deps(provider)
    const result = await generate(d, req)
    expect(result.data).toEqual({ answer: 'hi' })
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ ok: true, input_tokens: 1000, output_tokens: 200 })
    // 1000 * 0.3 / 1M + 200 * 2.5 / 1M
    expect(runs[0]?.cost_usd).toBeCloseTo(0.0008, 6)
  })

  it('retries once when the output fails the schema and sums the tokens', async () => {
    const provider = fakeProvider([
      { json: { wrong: 1 }, inputTokens: 10, outputTokens: 5 },
      { json: { answer: 'ok' }, inputTokens: 10, outputTokens: 5 },
    ])
    const { d, runs } = deps(provider)
    const result = await generate(d, req)
    expect(result.data.answer).toBe('ok')
    expect(provider.generate).toHaveBeenCalledTimes(2)
    expect(runs).toEqual([
      expect.objectContaining({ ok: true, input_tokens: 20, output_tokens: 10 }),
    ])
  })

  it('gives up after the retry and logs a failed run', async () => {
    const provider = fakeProvider([
      { json: null, inputTokens: 10, outputTokens: 5 },
      { json: { answer: 3 }, inputTokens: 10, outputTokens: 5 },
    ])
    const { d, runs } = deps(provider)
    await expect(generate(d, req)).rejects.toMatchObject({ code: 'invalid_output' })
    expect(runs).toEqual([expect.objectContaining({ ok: false, input_tokens: 20 })])
  })

  it('does not retry provider errors', async () => {
    const provider = fakeProvider([
      new Error('boom'),
      { json: { answer: 'x' }, inputTokens: 1, outputTokens: 1 },
    ])
    const { d, runs } = deps(provider)
    await expect(generate(d, req)).rejects.toMatchObject({ code: 'failed' })
    expect(provider.generate).toHaveBeenCalledTimes(1)
    expect(runs[0]).toMatchObject({ ok: false, error: 'failed: boom' })
  })

  it('logs and prices the model a provider fell back to', async () => {
    const provider = fakeProvider([
      {
        json: { answer: 'x' },
        inputTokens: 1_000_000,
        outputTokens: 0,
        model: 'gemini-2.5-flash-lite',
      },
    ])
    const { d, runs } = deps(provider)
    const result = await generate(d, req)
    expect(result.model).toBe('gemini-2.5-flash-lite')
    expect(runs[0]).toMatchObject({ model: 'gemini-2.5-flash-lite', cost_usd: 0.1 })
  })

  it('keeps the code of provider LlmErrors', async () => {
    const provider = fakeProvider([new LlmError('provider_busy', 'gemini 429')])
    const { d } = deps(provider)
    await expect(generate(d, req)).rejects.toMatchObject({ code: 'provider_busy' })
  })

  it('stops at the daily limit without calling the provider or logging', async () => {
    const provider = fakeProvider([])
    const { d, runs } = deps(provider, DAILY_AI_LIMIT)
    await expect(generate(d, req)).rejects.toMatchObject({ code: 'rate_limited' })
    expect(provider.generate).not.toHaveBeenCalled()
    expect(runs).toHaveLength(0)
  })
})

describe('getProvider', () => {
  const env = (values: Record<string, string>) => ({ get: (k: string) => values[k] })

  it('defaults to Gemini and needs its key', async () => {
    expect(await getProvider(env({}))).toBeNull()
    expect(isAiConfigured(env({}))).toBe(false)
    const p = await getProvider(env({ GEMINI_API_KEY: 'k', LLM_MODEL: 'gemini-2.5-flash' }))
    expect(p).toMatchObject({ name: 'gemini', model: 'gemini-2.5-flash' })
  })

  it('switches provider with LLM_PROVIDER only', async () => {
    expect(isAiConfigured(env({ LLM_PROVIDER: 'anthropic', GEMINI_API_KEY: 'k' }))).toBe(false)
    expect(isAiConfigured(env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }))).toBe(true)
    expect(await getProvider(env({ LLM_PROVIDER: 'other', GEMINI_API_KEY: 'k' }))).toBeNull()
  })
})

describe('jsonFromText', () => {
  it('reads a fenced or bare JSON object, null otherwise', () => {
    expect(jsonFromText('Evo:\n```json\n{"documents":[]}\n```')).toEqual({ documents: [] })
    expect(jsonFromText('Rezultat {"a": 1} kraj')).toEqual({ a: 1 })
    expect(jsonFromText('nema ništa')).toBeNull()
    expect(jsonFromText('{"a": ')).toBeNull()
  })
})

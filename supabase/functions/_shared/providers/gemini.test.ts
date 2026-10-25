import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { buildGeminiBody, geminiProvider, readGeminiResponse } from './gemini.ts'

const schema = z.object({ title: z.string(), note: z.string().nullable() })
const req = {
  task: 'parse_document' as const,
  system: 'You read documents.',
  text: 'Hello',
  files: [{ mediaType: 'application/pdf' as const, base64: 'QUJD' }],
  schema,
  maxTokens: 4000,
}

describe('buildGeminiBody', () => {
  it('puts files before the text and asks for JSON by schema', () => {
    const body = buildGeminiBody('gemini-2.5-flash', req)
    expect(body).toMatchObject({ systemInstruction: { parts: [{ text: 'You read documents.' }] } })
    expect(body.contents[0]?.parts).toEqual([
      { inlineData: { mimeType: 'application/pdf', data: 'QUJD' } },
      { text: 'Hello' },
    ])
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.maxOutputTokens).toBe(4000)
    const jsonSchema = body.generationConfig.responseJsonSchema
    expect(jsonSchema).not.toHaveProperty('$schema')
    expect(jsonSchema).toMatchObject({ type: 'object', required: ['title', 'note'] })
  })

  it('turns thinking off only for 2.5 models', () => {
    expect(buildGeminiBody('gemini-2.5-flash', req).generationConfig).toHaveProperty(
      'thinkingConfig',
      { thinkingBudget: 0 },
    )
    expect(buildGeminiBody('gemini-3-flash', req).generationConfig).not.toHaveProperty(
      'thinkingConfig',
    )
  })
})

describe('readGeminiResponse', () => {
  it('parses the JSON text and counts thinking as output', () => {
    const result = readGeminiResponse({
      candidates: [{ content: { parts: [{ text: '{"title":' }, { text: '"A","note":null}' }] } }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30, thoughtsTokenCount: 5 },
    })
    expect(result).toEqual({
      json: { title: 'A', note: null },
      inputTokens: 120,
      outputTokens: 35,
      cachedTokens: 0,
    })
  })

  it('returns null json for truncated output so the wrapper retries', () => {
    const result = readGeminiResponse({
      candidates: [{ content: { parts: [{ text: '{"title":"A' }] }, finishReason: 'MAX_TOKENS' }],
    })
    expect(result.json).toBeNull()
  })

  it('throws when nothing came back', () => {
    expect(() => readGeminiResponse({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow(
      /SAFETY/,
    )
  })
})

describe('geminiProvider', () => {
  const ok = () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"title":"x","note":null}' }] } }],
      }),
    )
  const sleep = async () => {}

  it('maps 429 to provider_busy without retrying the quota', async () => {
    const fetchMock = vi.fn(async () => new Response('quota', { status: 429 }))
    const provider = geminiProvider({
      apiKey: 'k',
      model: 'gemini-2.5-flash',
      fetch: fetchMock,
      sleep,
    })
    await expect(provider.generate(req)).rejects.toMatchObject({ code: 'provider_busy' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries an overloaded model (503) once', async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response('overloaded', { status: 503 }))
      .mockResolvedValueOnce(ok())
    const provider = geminiProvider({
      apiKey: 'k',
      model: 'gemini-2.5-flash',
      fetch: fetchMock,
      sleep,
    })
    await expect(provider.generate(req)).resolves.toMatchObject({ json: { title: 'x' } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up as provider_busy when the retry is overloaded too', async () => {
    const fetchMock = vi.fn(async () => new Response('overloaded', { status: 503 }))
    const provider = geminiProvider({
      apiKey: 'k',
      model: 'gemini-2.5-flash',
      fetch: fetchMock,
      sleep,
    })
    await expect(provider.generate(req)).rejects.toMatchObject({ code: 'provider_busy' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sends the key as a header, never in the URL', async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"title":"x","note":null}' }] } }],
          }),
        ),
    )
    const provider = geminiProvider({
      apiKey: 'secret',
      model: 'gemini-2.5-flash',
      fetch: fetchMock,
    })
    await provider.generate(req)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).not.toContain('secret')
    expect(String(url)).toContain('gemini-2.5-flash:generateContent')
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers['x-goog-api-key']).toBe('secret')
  })

  it('falls back to the second model when the first is out of quota', async () => {
    const perDay = JSON.stringify({
      error: {
        details: [
          { violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] },
        ],
      },
    })
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('gemini-2.5-flash:') ? new Response(perDay, { status: 429 }) : ok(),
    )
    const provider = geminiProvider({
      apiKey: 'k',
      model: 'gemini-2.5-flash',
      fallbackModel: 'gemini-2.5-flash-lite',
      fetch: fetchMock,
      sleep,
    })
    await expect(provider.generate(req)).resolves.toMatchObject({ model: 'gemini-2.5-flash-lite' })
  })

  it('tells a used-up daily quota apart from a busy model', async () => {
    const perDay = new Response('{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}', {
      status: 429,
    })
    const fetchMock = vi.fn(async () => perDay.clone())
    const provider = geminiProvider({
      apiKey: 'k',
      model: 'gemini-2.5-flash',
      fetch: fetchMock,
      sleep,
    })
    await expect(provider.generate(req)).rejects.toMatchObject({ code: 'quota_exhausted' })
  })
})

describe('explicit prompt cache', () => {
  const sleep = async () => {}
  const answer = () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"title":"x","note":null}' }] } }],
        usageMetadata: { promptTokenCount: 1500, cachedContentTokenCount: 1200 },
      }),
    )
  const memoryCache = () => {
    const rows = new Map<string, string>()
    return {
      rows,
      lookup: vi.fn(async (key: string) => rows.get(key) ?? null),
      save: vi.fn(async (key: string, name: string) => void rows.set(key, name)),
    }
  }
  const cachedReq = (cache: ReturnType<typeof memoryCache>) => ({
    ...req,
    files: [],
    prefix: 'STATE:\n' + 'x'.repeat(5000),
    cache,
  })
  const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string)

  it('creates a cache once and sends only the changing part with it', async () => {
    const cache = memoryCache()
    const fetchMock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
      String(url).endsWith('/cachedContents')
        ? new Response(JSON.stringify({ name: 'cachedContents/abc' }))
        : answer(),
    )
    const provider = geminiProvider({
      apiKey: 'k',
      model: 'gemini-3.5-flash-lite',
      fetch: fetchMock,
      sleep,
    })
    const first = await provider.generate(cachedReq(cache))
    await provider.generate(cachedReq(cache))
    const creates = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/cachedContents'))
    expect(creates).toHaveLength(1)
    const generate = bodyOf(fetchMock.mock.calls.at(-1)!)
    expect(generate.cachedContent).toBe('cachedContents/abc')
    expect(generate).not.toHaveProperty('systemInstruction')
    expect(JSON.stringify(generate.contents)).not.toContain('STATE:')
    expect(first.cachedTokens).toBe(1200)
  })

  it('remembers a refused cache and sends the full prompt', async () => {
    const cache = memoryCache()
    const fetchMock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
      String(url).endsWith('/cachedContents') ? new Response('no', { status: 400 }) : answer(),
    )
    const provider = geminiProvider({
      apiKey: 'k',
      model: 'gemini-3.5-flash-lite',
      fetch: fetchMock,
      sleep,
    })
    await provider.generate(cachedReq(cache))
    await provider.generate(cachedReq(cache))
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/cachedContents')),
    ).toHaveLength(1)
    expect([...cache.rows.values()]).toEqual([''])
    const generate = bodyOf(fetchMock.mock.calls.at(-1)!)
    expect(generate).toHaveProperty('systemInstruction')
    expect(JSON.stringify(generate.contents)).toContain('STATE:')
  })

  it('falls back to the full prompt when a stored cache is gone', async () => {
    const cache = memoryCache()
    const fetchMock = vi
      .fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: 'cachedContents/old' })))
      .mockResolvedValueOnce(new Response('expired', { status: 403 }))
      .mockResolvedValueOnce(answer())
    const provider = geminiProvider({
      apiKey: 'k',
      model: 'gemini-3.5-flash-lite',
      fetch: fetchMock,
      sleep,
    })
    await expect(provider.generate(cachedReq(cache))).resolves.toMatchObject({
      json: { title: 'x' },
    })
    expect(bodyOf(fetchMock.mock.calls[2]!)).toHaveProperty('systemInstruction')
  })

  it('skips caching for short prompts', async () => {
    const cache = memoryCache()
    const fetchMock = vi.fn(async () => answer())
    const provider = geminiProvider({
      apiKey: 'k',
      model: 'gemini-3.5-flash-lite',
      fetch: fetchMock,
      sleep,
    })
    await provider.generate({ ...req, files: [], prefix: 'STATE:\n{}', cache })
    expect(cache.lookup).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('web search (Google Search grounding)', () => {
  const search = { ...req, files: [], webSearch: { maxUses: 4 } }
  it('adds the search tool and asks for the JSON in the prompt instead of a response schema', () => {
    const body = buildGeminiBody('gemini-3.5-flash-lite', search) as Record<string, unknown>
    expect(body.tools).toEqual([{ google_search: {} }])
    const config = body.generationConfig as Record<string, unknown>
    expect(config.responseJsonSchema).toBeUndefined()
    expect(config.responseMimeType).toBeUndefined()
    const system = (body.systemInstruction as { parts: { text: string }[] }).parts[0]!.text
    expect(system).toContain('Answer with only one JSON object')
  })

  it('reads the JSON from the text and the grounding sources', () => {
    const out = readGeminiResponse(
      {
        candidates: [
          {
            content: { parts: [{ text: '```json\n{"title":"T","note":null}\n```' }] },
            groundingMetadata: {
              groundingChunks: [{ web: { uri: 'https://redirect/x', title: 'etf.unsa.ba' } }, {}],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      },
      true,
    )
    expect(out.json).toEqual({ title: 'T', note: null })
    expect(out.sources).toEqual([{ url: 'https://redirect/x', title: 'etf.unsa.ba' }])
  })
})

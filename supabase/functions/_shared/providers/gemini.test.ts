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
    expect(body.systemInstruction.parts[0]?.text).toBe('You read documents.')
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
    expect(result).toEqual({ json: { title: 'A', note: null }, inputTokens: 120, outputTokens: 35 })
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
  it('maps 429 to provider_busy', async () => {
    const fetchMock = vi.fn(async () => new Response('quota', { status: 429 }))
    const provider = geminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetch: fetchMock })
    await expect(provider.generate(req)).rejects.toMatchObject({ code: 'provider_busy' })
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
})

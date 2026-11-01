import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { buildChatBody, openAiCompatProvider } from './openaiCompat.ts'

const req = {
  task: 'parse_toc' as const,
  system: 'sys',
  text: 'Sadržaj',
  files: [{ mediaType: 'image/jpeg' as const, base64: 'QQ==' }],
  schema: z.object({ units: z.array(z.string()) }),
  maxTokens: 500,
}

describe('openAiCompatProvider', () => {
  it('sends JSON mode with the schema in the system prompt and images as data URLs', () => {
    const body = buildChatBody('llama', req)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[0]!.content).toContain('sys')
    expect(JSON.stringify(body.messages[1])).toContain('data:image/jpeg;base64,QQ==')
  })

  it('reads the JSON answer and the usage', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"units":["1 Uvod"]}' } }],
            usage: { prompt_tokens: 12, completion_tokens: 5 },
          }),
        ),
    )
    const p = openAiCompatProvider({ name: 'groq', apiKey: 'k', model: 'llama', fetch: fetchMock })
    const r = await p.generate(req)
    expect(r).toMatchObject({ json: { units: ['1 Uvod'] }, inputTokens: 12, outputTokens: 5 })
    expect(String((fetchMock.mock.calls as unknown as [string][])[0]![0])).toBe(
      'https://api.groq.com/openai/v1/chat/completions',
    )
  })

  it('a daily 429 is the quota, another 429 is busy; PDFs and web search are not supported', async () => {
    const daily = openAiCompatProvider({
      name: 'openrouter',
      apiKey: 'k',
      model: 'm:free',
      fetch: async () => new Response('Rate limit exceeded: free-models-per-day', { status: 429 }),
    })
    await expect(daily.generate(req)).rejects.toMatchObject({ code: 'quota_exhausted' })
    const minute = openAiCompatProvider({
      name: 'groq',
      apiKey: 'k',
      model: 'llama',
      fetch: async () =>
        new Response('Rate limit reached for requests per minute', { status: 429 }),
    })
    await expect(minute.generate(req)).rejects.toMatchObject({ code: 'provider_busy' })
    expect(
      minute.supports!({ ...req, files: [{ mediaType: 'application/pdf', base64: 'QQ==' }] }),
    ).toBe(false)
    expect(minute.supports!({ ...req, webSearch: { maxUses: 2 } })).toBe(false)
  })
})

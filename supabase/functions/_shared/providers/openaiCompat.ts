// Groq and OpenRouter through their OpenAI-compatible chat completions API (no SDK), for the free
// chain (`chain.ts`). JSON mode plus the schema in the system prompt; the wrapper validates the
// answer with the same Zod schema. No PDFs and no web search: those calls go to the next model.
import { toJsonSchema } from '../jsonSchema.ts'
import { jsonFromText, jsonInstruction, LlmError, ProviderBusyError } from '../llm.ts'
import type { LlmProvider, LlmRawResult, LlmRequest } from '../llm.ts'

export const OPENAI_COMPAT_URLS = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
} as const

export interface OpenAiCompatConfig {
  name: keyof typeof OPENAI_COMPAT_URLS
  apiKey: string
  model: string
  fetch?: typeof fetch
}

export function buildChatBody(model: string, req: LlmRequest<unknown>) {
  const images = (req.files ?? []).map((f) => ({
    type: 'image_url',
    image_url: { url: `data:${f.mediaType};base64,${f.base64}` },
  }))
  const text = [req.prefix, req.text].filter(Boolean).join('\n\n')
  return {
    model,
    messages: [
      { role: 'system', content: `${req.system}\n\n${jsonInstruction(toJsonSchema(req.schema))}` },
      { role: 'user', content: images.length > 0 ? [...images, { type: 'text', text }] : text },
    ],
    response_format: { type: 'json_object' },
    max_tokens: req.maxTokens,
    temperature: 0.2,
  }
}

/** 429 with a daily limit is the quota (until the reset); other 429 / 5xx are "busy". */
async function statusError(name: string, res: Response): Promise<LlmError> {
  const body = await res.text().catch(() => '')
  if (res.status === 429)
    return /per.?day|daily|tokens per day|requests per day|free-models-per-day/i.test(body)
      ? new LlmError('quota_exhausted', `${name} 429 per-day quota`)
      : new ProviderBusyError(`${name} 429`)
  if (res.status >= 500) return new ProviderBusyError(`${name} ${res.status}`)
  return new LlmError('failed', `${name} ${res.status}: ${body}`.slice(0, 300))
}

export function openAiCompatProvider({
  name,
  apiKey,
  model,
  fetch: doFetch = fetch,
}: OpenAiCompatConfig): LlmProvider {
  return {
    name,
    model,
    supports: (req) =>
      !req.webSearch && !(req.files ?? []).some((f) => f.mediaType === 'application/pdf'),
    async generate(req): Promise<LlmRawResult> {
      const res = await doFetch(`${OPENAI_COMPAT_URLS[name]}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(buildChatBody(model, req)),
      })
      if (!res.ok) throw await statusError(name, res)
      const data = (await res.json()) as {
        model?: string
        choices?: { message?: { content?: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }
      return {
        json: jsonFromText(data.choices?.[0]?.message?.content ?? ''),
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        model,
      }
    },
  }
}

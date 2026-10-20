// Gemini through the REST API (no SDK): structured output via `responseJsonSchema`,
// derived from the same Zod schema with z.toJSONSchema().
import { toJsonSchema } from '../jsonSchema.ts'
import { LlmError, ProviderBusyError } from '../llm.ts'
import type { LlmProvider, LlmRawResult, LlmRequest } from '../llm.ts'

const API = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface GeminiConfig {
  apiKey: string
  model: string
  fetch?: typeof fetch
}

export function buildGeminiBody(model: string, req: LlmRequest<unknown>) {
  const parts: Record<string, unknown>[] = (req.files ?? []).map((f) => ({
    inlineData: { mimeType: f.mediaType, data: f.base64 },
  }))
  parts.push({ text: req.text })
  return {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: toJsonSchema(req.schema),
      maxOutputTokens: req.maxTokens,
      temperature: 0.2,
      // 2.5 models think by default and thinking tokens eat into maxOutputTokens;
      // extraction does not need it.
      ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
  }
  promptFeedback?: { blockReason?: string }
}

export function readGeminiResponse(body: GeminiResponse): LlmRawResult {
  const usage = body.usageMetadata ?? {}
  const inputTokens = usage.promptTokenCount ?? 0
  const outputTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0)
  const candidate = body.candidates?.[0]
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  if (!text) {
    const reason = body.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'empty'
    throw new LlmError('failed', `gemini: no output (${reason})`)
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    // Truncated (MAX_TOKENS) or malformed JSON: counts as invalid output, so it is retried.
    json = null
  }
  return { json, inputTokens, outputTokens }
}

export function geminiProvider({
  apiKey,
  model,
  fetch: doFetch = fetch,
}: GeminiConfig): LlmProvider {
  return {
    name: 'gemini',
    model,
    async generate(req) {
      const res = await doFetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(buildGeminiBody(model, req)),
      })
      if (res.status === 429 || res.status === 503) {
        throw new ProviderBusyError(`gemini ${res.status}`)
      }
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300)
        throw new LlmError('failed', `gemini ${res.status}: ${detail}`)
      }
      return readGeminiResponse((await res.json()) as GeminiResponse)
    },
  }
}

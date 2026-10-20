// Gemini through the REST API (no SDK): structured output via `responseJsonSchema`,
// derived from the same Zod schema with z.toJSONSchema().
import { toJsonSchema } from '../jsonSchema.ts'
import { LlmError, ProviderBusyError } from '../llm.ts'
import type { LlmProvider, LlmRawResult, LlmRequest } from '../llm.ts'

const API = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface GeminiConfig {
  apiKey: string
  model: string
  /** Tried when `model` is busy or out of free quota (quotas are per model). */
  fallbackModel?: string | null
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

/** "Model is overloaded" (503) and 500 pass within seconds; 429 is the quota, not retried. */
const RETRY_STATUSES = new Set([500, 503])
const RETRY_DELAY_MS = 2000

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

/** 429 per-day quota (free tier) vs. per-minute limit or overload. */
export async function busyError(res: Response): Promise<LlmError> {
  const body = res.status === 429 ? await res.text().catch(() => '') : ''
  return /PerDay/i.test(body)
    ? new LlmError('quota_exhausted', `gemini 429 per-day quota`)
    : new ProviderBusyError(`gemini ${res.status}`)
}

export function geminiProvider({
  apiKey,
  model,
  fallbackModel = null,
  fetch: doFetch = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: GeminiConfig): LlmProvider {
  return {
    name: 'gemini',
    model,
    async generate(req) {
      const call = (m: string) =>
        doFetch(`${API}/${encodeURIComponent(m)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(buildGeminiBody(m, req)),
        })
      const models = fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model]
      let busy: LlmError | null = null
      for (const m of models) {
        let res = await call(m)
        if (RETRY_STATUSES.has(res.status)) {
          await sleep(RETRY_DELAY_MS)
          res = await call(m)
        }
        if (res.ok) return { ...readGeminiResponse((await res.json()) as GeminiResponse), model: m }
        if (res.status === 429 || RETRY_STATUSES.has(res.status)) {
          busy = await busyError(res)
          continue
        }
        const detail = (await res.text()).slice(0, 300)
        throw new LlmError('failed', `gemini ${res.status}: ${detail}`)
      }
      throw busy ?? new ProviderBusyError('gemini')
    },
  }
}

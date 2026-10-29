// Gemini through the REST API (no SDK): structured output via `responseJsonSchema`,
// derived from the same Zod schema with z.toJSONSchema(). The stable part of a prompt
// (system + prefix) goes into an explicit context cache when the request allows it.
import { toJsonSchema } from '../jsonSchema.ts'
import { jsonFromText, jsonInstruction, LlmError, ProviderBusyError } from '../llm.ts'
import type { LlmProvider, LlmRawResult, LlmRequest } from '../llm.ts'

const API = 'https://generativelanguage.googleapis.com/v1beta'

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

/** Explicit caches need a minimum prefix (~1024 tokens on Flash); below it, skip creating one. */
export const MIN_CACHE_CHARS = 4000
export const CACHE_TTL_S = 600
/** After a refused cache (e.g. not offered on the free tier), wait before trying again. */
const CACHE_RETRY_AFTER_S = 3600

/** User parts: files, then the stable prefix (unless it is in the cache), then the text. */
function userParts(req: LlmRequest<unknown>, withPrefix: boolean) {
  const parts: Record<string, unknown>[] = (req.files ?? []).map((f) => ({
    inlineData: { mimeType: f.mediaType, data: f.base64 },
  }))
  if (withPrefix && req.prefix) parts.push({ text: req.prefix })
  parts.push({ text: req.text })
  return parts
}

export function buildGeminiBody(model: string, req: LlmRequest<unknown>, cacheName?: string) {
  // With Google Search grounding the JSON is asked for in the prompt (older models do not
  // combine tools with a response schema); the wrapper validates it with the same schema.
  const search = Boolean(req.webSearch)
  const system = search
    ? `${req.system}\n\n${jsonInstruction(toJsonSchema(req.schema))}`
    : req.system
  return {
    // A cached request carries system + prefix inside the cache.
    ...(cacheName
      ? { cachedContent: cacheName }
      : { systemInstruction: { parts: [{ text: system }] } }),
    contents: [{ role: 'user', parts: userParts(req, !cacheName) }],
    ...(search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      ...(search
        ? {}
        : { responseMimeType: 'application/json', responseJsonSchema: toJsonSchema(req.schema) }),
      maxOutputTokens: req.maxTokens,
      temperature: 0.2,
      // 2.5 models think by default and thinking tokens eat into maxOutputTokens;
      // extraction does not need it.
      ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  }
}

/** Stable key of what is cached: model, system prompt and prefix. */
export async function cacheKey(model: string, req: LlmRequest<unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(`${model}\u0000${req.system}\u0000${req.prefix ?? ''}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] }
    finishReason?: string
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] }
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
    cachedContentTokenCount?: number
  }
  promptFeedback?: { blockReason?: string }
}

export function readGeminiResponse(body: GeminiResponse, fromText = false): LlmRawResult {
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
  if (fromText) json = jsonFromText(text)
  else
    try {
      json = JSON.parse(text)
    } catch {
      // Truncated (MAX_TOKENS) or malformed JSON: counts as invalid output, so it is retried.
      json = null
    }
  // Grounding: the pages the search used (uri is a Google redirect, title the site's domain).
  const sources = (candidate?.groundingMetadata?.groundingChunks ?? []).flatMap((c) =>
    c.web?.uri ? [{ url: c.web.uri, title: c.web.title ?? null }] : [],
  )
  return {
    json,
    inputTokens,
    outputTokens,
    cachedTokens: usage.cachedContentTokenCount ?? 0,
    ...(fromText ? { sources } : {}),
  }
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
  const headers = { 'content-type': 'application/json', 'x-goog-api-key': apiKey }

  /** Existing or new cache for system + prefix; null = send everything uncached. */
  async function cacheFor(m: string, req: LlmRequest<unknown>): Promise<string | null> {
    if (!req.cache || !req.prefix) return null
    if (req.system.length + req.prefix.length < MIN_CACHE_CHARS) return null
    const key = await cacheKey(m, req)
    const known = await req.cache.lookup(key)
    if (known !== null) return known || null
    const res = await doFetch(`${API}/cachedContents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: `models/${m}`,
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.prefix }] }],
        ttl: `${CACHE_TTL_S}s`,
      }),
    }).catch(() => null)
    if (!res?.ok) {
      // Refused (free tier, too small, ...): remember it so we don't pay a request each time.
      await req.cache.save(key, '', new Date(Date.now() + CACHE_RETRY_AFTER_S * 1000))
      return null
    }
    const { name } = (await res.json()) as { name?: string }
    if (!name) return null
    // Expire a bit early so we never send a name the API has already dropped.
    await req.cache.save(key, name, new Date(Date.now() + (CACHE_TTL_S - 30) * 1000))
    return name
  }

  /**
   * One call with the primary model and, when it is busy or out of quota, the fallback one; a
   * cache that is gone falls back to the full prompt, a 500/503 is tried once more.
   */
  async function call(
    req: LlmRequest<unknown>,
    method: 'generateContent' | 'streamGenerateContent?alt=sse',
    read: (res: Response, m: string) => Promise<LlmRawResult>,
  ): Promise<LlmRawResult> {
    const post = (m: string, cacheName?: string) =>
      doFetch(`${API}/models/${encodeURIComponent(m)}:${method}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildGeminiBody(m, req, cacheName)),
      })
    const models = fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model]
    let busy: LlmError | null = null
    for (const m of models) {
      // Caches belong to one model; only the primary one uses it (never with web search).
      const cacheName = m === model && !req.webSearch ? await cacheFor(m, req) : null
      let res = await post(m, cacheName ?? undefined)
      if (cacheName && res.status >= 400 && res.status < 500 && res.status !== 429) {
        // A cache that expired or was dropped early: send the full prompt instead.
        res = await post(m)
      }
      if (RETRY_STATUSES.has(res.status)) {
        await sleep(RETRY_DELAY_MS)
        res = await post(m)
      }
      if (res.ok) return { ...(await read(res, m)), model: m }
      if (res.status === 429 || RETRY_STATUSES.has(res.status)) {
        busy = await busyError(res)
        continue
      }
      const detail = (await res.text()).slice(0, 300)
      throw new LlmError('failed', `gemini ${res.status}: ${detail}`)
    }
    throw busy ?? new ProviderBusyError('gemini')
  }

  return {
    name: 'gemini',
    model,
    generate: (req) =>
      call(req, 'generateContent', async (res) =>
        readGeminiResponse((await res.json()) as GeminiResponse, Boolean(req.webSearch)),
      ),
    stream: (req, onText) =>
      call(req, 'streamGenerateContent?alt=sse', async (res) => {
        const whole = await readGeminiStream(res, onText)
        return readGeminiResponse(whole, Boolean(req.webSearch))
      }),
  }
}

/**
 * Server-sent events of streamGenerateContent: each `data:` line is a response with the next
 * piece of text; the last one carries the usage. Returns them joined as one response.
 */
export async function readGeminiStream(
  res: Response,
  onText: (delta: string) => void,
): Promise<GeminiResponse> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let text = ''
  let last: GeminiResponse = {}
  const take = (line: string) => {
    if (!line.startsWith('data:')) return
    const chunk = JSON.parse(line.slice(5).trim()) as GeminiResponse
    const delta = (chunk.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
    if (delta) {
      text += delta
      onText(delta)
    }
    last = chunk
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) take(line)
  }
  take(buffer)
  const candidate = last.candidates?.[0]
  return {
    ...last,
    candidates: [{ ...candidate, content: { parts: [{ text }] } }],
  }
}

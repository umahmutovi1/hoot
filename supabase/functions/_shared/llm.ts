// The only way Edge Functions talk to an LLM. Provider and model come from the
// LLM_PROVIDER / LLM_MODEL secrets, so switching Gemini -> Haiku is `supabase secrets set`.
// Shared work lives here: rate limit, Zod validation with one retry, cost and the ai_runs log.
import type { z } from 'zod'
import type { AiErrorCode } from './schemas.ts'
import { costUsd } from './prices.ts'

export type AiTask =
  | 'parse_academic_calendar'
  | 'parse_exam_schedule'
  | 'parse_document'
  | 'answer'
  | 'parse_toc'
  | 'parse_questions'
  | 'link_questions'
  | 'parse_timetable'
  | 'recall_questions'
  | 'propose_answer'
  | 'parse_syllabus'
  | 'find_academic_info'

export type LlmMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

export interface LlmFile {
  mediaType: LlmMediaType
  base64: string
}

/** Where a provider keeps the name of an explicit prompt cache (per conversation). */
export interface PromptCacheStore {
  /** Cache name for this key; '' = caching was refused, do not try again for now. */
  lookup(key: string): Promise<string | null>
  save(key: string, name: string, expiresAt: Date): Promise<void>
}

export interface LlmRequest<T> {
  task: AiTask
  system: string
  /** Stable text sent right after the system prompt (e.g. the state summary); cacheable. */
  prefix?: string
  /** Lets the provider cache system + prefix explicitly across calls. */
  cache?: PromptCacheStore
  /** The part that changes on every call (question, passages, document). */
  text: string
  files?: LlmFile[]
  schema: z.ZodType<T>
  maxTokens: number
  /**
   * Web search (find-academic-info, Stage 10c): Google Search grounding on Gemini, the web
   * search tool on Anthropic. The JSON then comes as text (search results carry citations,
   * which strict structured output does not allow) and is validated by the same schema.
   */
  webSearch?: { maxUses: number }
}

/** A page the web search actually returned (title may be just the domain). */
export interface WebSource {
  url: string
  title: string | null
}

/** What a provider returns: the raw JSON (validated by the wrapper) and token usage. */
export interface LlmRawResult {
  json: unknown
  inputTokens: number
  outputTokens: number
  /** The model that answered when a provider fell back to another one. */
  model?: string
  /** Input tokens served from a prompt cache (explicit or implicit). */
  cachedTokens?: number
  /** Pages the web search returned (only with `webSearch`). */
  sources?: WebSource[]
}

export interface LlmProvider {
  name: string
  model: string
  generate(req: LlmRequest<unknown>): Promise<LlmRawResult>
}

export interface LlmResult<T> {
  data: T
  /** Pages the web search returned (only with `webSearch`). */
  sources: WebSource[]
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number | null
}

export interface AiRunLog {
  task: AiTask
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number | null
  cached_tokens: number | null
  ok: boolean
  error: string | null
}

export interface LlmDeps {
  provider: LlmProvider
  /** AI calls already made in the rate-limit window. */
  countRecentRuns: () => Promise<number>
  logRun: (run: AiRunLog) => Promise<void>
}

export const DAILY_AI_LIMIT = 30

export class LlmError extends Error {
  readonly code: AiErrorCode
  constructor(code: AiErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

/** Thrown by providers for errors worth a different user message (429 / overloaded). */
export class ProviderBusyError extends LlmError {
  constructor(message?: string) {
    super('provider_busy', message)
  }
}

export async function generate<T>(deps: LlmDeps, req: LlmRequest<T>): Promise<LlmResult<T>> {
  const used = await deps.countRecentRuns()
  if (used >= DAILY_AI_LIMIT) throw new LlmError('rate_limited')

  const { provider } = deps
  let inputTokens = 0
  let outputTokens = 0
  let model = provider.model
  let cachedTokens: number | null = null
  let lastError: unknown = null

  // One retry, only when the output does not pass the Zod schema.
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: LlmRawResult
    try {
      raw = await provider.generate(req as LlmRequest<unknown>)
    } catch (err) {
      lastError = err
      break
    }
    inputTokens += raw.inputTokens
    outputTokens += raw.outputTokens
    model = raw.model ?? provider.model
    if (raw.cachedTokens !== undefined) cachedTokens = (cachedTokens ?? 0) + raw.cachedTokens
    const parsed = req.schema.safeParse(raw.json)
    if (parsed.success) {
      const cost = costUsd(model, inputTokens, outputTokens)
      await deps.logRun({
        task: req.task,
        provider: provider.name,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: cost,
        cached_tokens: cachedTokens,
        ok: true,
        error: null,
      })
      return {
        data: parsed.data,
        sources: raw.sources ?? [],
        provider: provider.name,
        model,
        inputTokens,
        outputTokens,
        costUsd: cost,
      }
    }
    lastError = new LlmError('invalid_output', parsed.error.message.slice(0, 500))
  }

  const error =
    lastError instanceof LlmError ? lastError : new LlmError('failed', errorMessage(lastError))
  await deps.logRun({
    task: req.task,
    provider: provider.name,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd(model, inputTokens, outputTokens),
    cached_tokens: cachedTokens,
    ok: false,
    error: `${error.code}: ${error.message}`.slice(0, 1000),
  })
  throw error
}

/**
 * The first JSON object in a model's text answer (with or without a ```json fence); null when
 * there is none, so the wrapper counts it as invalid output and retries once.
 */
export function jsonFromText(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = fenced ? fenced[1]! : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }
}

/** Instruction for a text answer that has to match the request's schema (web search calls). */
export function jsonInstruction(schema: unknown): string {
  return `Answer with only one JSON object that matches this JSON Schema, no other text:\n${JSON.stringify(schema)}`
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export interface LlmEnv {
  get(key: string): string | undefined
}

/** Reads LLM_PROVIDER / LLM_MODEL and the matching key; null when AI is not configured. */
export async function getProvider(env: LlmEnv): Promise<LlmProvider | null> {
  const name = env.get('LLM_PROVIDER') ?? 'gemini'
  if (name === 'gemini') {
    const key = env.get('GEMINI_API_KEY')
    if (!key) return null
    const { geminiProvider } = await import('./providers/gemini.ts')
    return geminiProvider({
      apiKey: key,
      model: env.get('LLM_MODEL') ?? 'gemini-2.5-flash',
      fallbackModel: env.get('LLM_FALLBACK_MODEL') ?? null,
    })
  }
  if (name === 'anthropic') {
    const key = env.get('ANTHROPIC_API_KEY')
    if (!key) return null
    const { anthropicProvider } = await import('./providers/anthropic.ts')
    return anthropicProvider({ apiKey: key, model: env.get('LLM_MODEL') ?? 'claude-haiku-5-5' })
  }
  return null
}

export function isAiConfigured(env: LlmEnv): boolean {
  const name = env.get('LLM_PROVIDER') ?? 'gemini'
  if (name === 'gemini') return Boolean(env.get('GEMINI_API_KEY'))
  if (name === 'anthropic') return Boolean(env.get('ANTHROPIC_API_KEY'))
  return false
}

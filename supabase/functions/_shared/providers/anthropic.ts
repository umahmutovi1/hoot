// Claude through the official SDK: structured outputs with zodOutputFormat() + messages.parse().
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { toJsonSchema } from '../jsonSchema.ts'
import { jsonFromText, jsonInstruction, LlmError, ProviderBusyError } from '../llm.ts'
import type { LlmProvider, LlmRawResult, LlmRequest, WebSource } from '../llm.ts'

/** The basic web search tool; the dynamic-filtering variant is only on Opus and Sonnet. */
const WEB_SEARCH = 'web_search_20250305'
/** Server-side search loops can pause; resume at most this many times. */
const MAX_RESUMES = 2

/**
 * Web search call (find-academic-info): no strict output format (search results carry
 * citations), the JSON comes as text and the wrapper validates it with the schema.
 */
async function withWebSearch(
  client: Anthropic,
  model: string,
  req: LlmRequest<unknown>,
): Promise<LlmRawResult> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: req.text }]
  const tools = [
    { type: WEB_SEARCH, name: 'web_search', max_uses: req.webSearch!.maxUses },
  ] as unknown as Anthropic.ToolUnion[]
  const system = `${req.system}\n\n${jsonInstruction(toJsonSchema(req.schema))}`
  const sources: WebSource[] = []
  let inputTokens = 0
  let outputTokens = 0
  let text = ''
  for (let turn = 0; turn <= MAX_RESUMES; turn++) {
    const response = await client.messages.create({
      model,
      max_tokens: req.maxTokens,
      system,
      tools,
      messages,
      output_config: { effort: 'low' },
    })
    inputTokens += response.usage.input_tokens
    outputTokens += response.usage.output_tokens
    for (const block of response.content) {
      if (block.type === 'text') text += block.text
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content))
        for (const r of block.content)
          if (r.type === 'web_search_result') sources.push({ url: r.url, title: r.title ?? null })
    }
    if (response.stop_reason === 'refusal') throw new LlmError('failed', 'anthropic: refusal')
    if (response.stop_reason !== 'pause_turn') break
    // Resume where the server stopped: the paused assistant turn goes back as it is.
    messages.push({ role: 'assistant', content: response.content })
    text = ''
  }
  return { json: jsonFromText(text), inputTokens, outputTokens, sources }
}

export interface AnthropicConfig {
  apiKey: string
  model: string
}

/** Rate limits and overload are "busy"; other API errors are failures with their status. */
function mapError(err: unknown): unknown {
  if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError)
    return new ProviderBusyError(`anthropic ${err.status}`)
  if (err instanceof Anthropic.APIError)
    return new LlmError('failed', `anthropic ${err.status}: ${err.message}`.slice(0, 300))
  return err
}

/** System, prefix (cache breakpoints), files and text, and the structured output format. */
function params(model: string, req: LlmRequest<unknown>) {
  // The stable prefix comes first with a cache breakpoint, so system + prefix are reused
  // across calls (Anthropic ignores breakpoints below its minimum prefix length).
  const content: Anthropic.ContentBlockParam[] = req.prefix
    ? [{ type: 'text', text: req.prefix, cache_control: { type: 'ephemeral' } }]
    : []
  const files: Anthropic.ContentBlockParam[] = (req.files ?? []).map((f) =>
    f.mediaType === 'application/pdf'
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: f.base64 },
        }
      : { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.base64 } },
  )
  content.push(...files, { type: 'text', text: req.text })
  return {
    model,
    max_tokens: req.maxTokens,
    system: [
      { type: 'text' as const, text: req.system, cache_control: { type: 'ephemeral' as const } },
    ],
    messages: [{ role: 'user' as const, content }],
    // Extraction and short answers: low effort keeps thinking (and cost) small.
    output_config: { effort: 'low' as const, format: zodOutputFormat(req.schema) },
  }
}

function usageOf(usage: Anthropic.Usage) {
  return {
    // input_tokens excludes cached tokens; count all of them like Gemini does.
    inputTokens:
      usage.input_tokens +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
    cachedTokens: usage.cache_read_input_tokens ?? 0,
  }
}

export function anthropicProvider({ apiKey, model }: AnthropicConfig): LlmProvider {
  const client = new Anthropic({ apiKey, maxRetries: 1 })
  return {
    name: 'anthropic',
    model,
    async generate(req) {
      try {
        if (req.webSearch) return await withWebSearch(client, model, req)
        const response = await client.messages.parse(params(model, req))
        if (response.stop_reason === 'refusal') throw new LlmError('failed', 'anthropic: refusal')
        return {
          // null when the output did not parse; the wrapper treats that as invalid and retries.
          json: response.parsed_output ?? null,
          ...usageOf(response.usage),
        }
      } catch (err) {
        throw mapError(err)
      }
    },
    async stream(req, onText) {
      try {
        const stream = client.messages.stream(params(model, req))
        stream.on('text', (delta) => onText(delta))
        const response = await stream.finalMessage()
        if (response.stop_reason === 'refusal') throw new LlmError('failed', 'anthropic: refusal')
        const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
        return { json: jsonFromText(text), ...usageOf(response.usage) }
      } catch (err) {
        throw mapError(err)
      }
    },
  }
}

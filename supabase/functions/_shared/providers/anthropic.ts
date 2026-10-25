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

export function anthropicProvider({ apiKey, model }: AnthropicConfig): LlmProvider {
  const client = new Anthropic({ apiKey, maxRetries: 1 })
  return {
    name: 'anthropic',
    model,
    async generate(req) {
      if (req.webSearch) {
        try {
          return await withWebSearch(client, model, req)
        } catch (err) {
          if (
            err instanceof Anthropic.RateLimitError ||
            err instanceof Anthropic.InternalServerError
          )
            throw new ProviderBusyError(`anthropic ${err.status}`)
          if (err instanceof Anthropic.APIError)
            throw new LlmError('failed', `anthropic ${err.status}: ${err.message}`.slice(0, 300))
          throw err
        }
      }
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
      try {
        const response = await client.messages.parse({
          model,
          max_tokens: req.maxTokens,
          system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content }],
          // Extraction and short answers: low effort keeps thinking (and cost) small.
          output_config: { effort: 'low', format: zodOutputFormat(req.schema) },
        })
        if (response.stop_reason === 'refusal') throw new LlmError('failed', 'anthropic: refusal')
        return {
          // null when the output did not parse; the wrapper treats that as invalid and retries.
          json: response.parsed_output ?? null,
          // input_tokens excludes cached tokens; count all of them like Gemini does.
          inputTokens:
            response.usage.input_tokens +
            (response.usage.cache_read_input_tokens ?? 0) +
            (response.usage.cache_creation_input_tokens ?? 0),
          outputTokens: response.usage.output_tokens,
          cachedTokens: response.usage.cache_read_input_tokens ?? 0,
        }
      } catch (err) {
        if (
          err instanceof Anthropic.RateLimitError ||
          err instanceof Anthropic.InternalServerError
        ) {
          throw new ProviderBusyError(`anthropic ${err.status}`)
        }
        if (err instanceof Anthropic.APIError) {
          throw new LlmError('failed', `anthropic ${err.status}: ${err.message}`.slice(0, 300))
        }
        throw err
      }
    },
  }
}

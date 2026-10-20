// Claude through the official SDK: structured outputs with zodOutputFormat() + messages.parse().
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { LlmError, ProviderBusyError } from '../llm.ts'
import type { LlmProvider } from '../llm.ts'

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

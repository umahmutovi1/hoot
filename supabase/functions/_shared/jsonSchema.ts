import { z } from 'zod'

/**
 * JSON Schema for a provider's structured output. Drops `$schema` (Gemini rejects unknown
 * top-level keys) and keeps everything inline: the schemas are flat and never recursive.
 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'output' }) as Record<
    string,
    unknown
  >
  delete json.$schema
  return json
}

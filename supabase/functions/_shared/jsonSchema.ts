import { z } from 'zod'

/** Length limits Gemini rejects with 400 INVALID_ARGUMENT; Zod still checks them on the output. */
const DROPPED = ['maxLength', 'maxItems'] as const

function strip(node: unknown): void {
  if (Array.isArray(node)) node.forEach(strip)
  else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    for (const key of DROPPED) delete obj[key]
    Object.values(obj).forEach(strip)
  }
}

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
  strip(json)
  return json
}

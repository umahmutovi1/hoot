// Streaming answers (PRD "AI asistent"): the model streams one JSON object; the user should see
// the "answer" text while it is written. Pure, tested with Vitest like the other _shared code.

const ESCAPES: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
}

/**
 * The value written so far of a top-level string field in the beginning of a JSON object
 * (`{"answer": "Ispit je u pe`→ "Ispit je u pe"); null until the value has started. An escape cut
 * off at the end is left out until the rest arrives.
 */
export function partialStringField(json: string, field: string): string | null {
  const key = new RegExp(`"${field}"\\s*:\\s*"`).exec(json)
  if (!key) return null
  let out = ''
  for (let i = key.index + key[0].length; i < json.length; i++) {
    const c = json[i]!
    if (c === '"') return out
    if (c !== '\\') {
      out += c
      continue
    }
    const next = json[i + 1]
    if (next === undefined) return out
    if (next === 'u') {
      const hex = json.slice(i + 2, i + 6)
      if (hex.length < 4) return out
      out += String.fromCharCode(parseInt(hex, 16))
      i += 5
      continue
    }
    out += ESCAPES[next] ?? next
    i++
  }
  return out
}

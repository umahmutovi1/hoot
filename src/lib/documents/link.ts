/**
 * A link in what the user typed (chat, "Link" in Daj dokument): the first http(s) or www. address,
 * without the punctuation a sentence puts after it, and the rest of the text as the note.
 */
export function splitLink(text: string): { url: string; rest: string } | null {
  const match = /(?:https?:\/\/|www\.)[^\s<>"]+/i.exec(text)
  if (!match) return null
  const raw = match[0].replace(/[.,;:!?)\]}'"»]+$/, '')
  const url = normalizeLink(raw)
  if (!url) return null
  const rest = (text.slice(0, match.index) + text.slice(match.index + raw.length))
    .replace(/\s+/g, ' ')
    .trim()
  return { url, rest }
}

/** A typed address as a full URL ("etf.unsa.ba/x" → "https://etf.unsa.ba/x"), null if it is not one. */
export function normalizeLink(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  try {
    const u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
    return u.hostname.includes('.') ? u.toString() : null
  } catch {
    return null
  }
}

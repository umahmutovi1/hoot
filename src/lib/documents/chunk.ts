// Splits document text into passages for gte-small embeddings (max ~512 tokens, so passages
// stay around 1000 characters). Paragraphs are kept whole when they fit; a passage never
// crosses a page, so every answer can cite its page.

export interface PageText {
  page: number
  text: string
}

export interface Chunk {
  page: number
  position: number
  content: string
}

export const CHUNK_CHARS = 1000

export function chunkPages(pages: readonly PageText[], maxChars = CHUNK_CHARS): Chunk[] {
  const chunks: Chunk[] = []
  for (const { page, text } of pages) {
    let current = ''
    const flush = () => {
      const content = current.trim()
      if (content) chunks.push({ page, position: chunks.length, content })
      current = ''
    }
    for (const piece of pieces(text, maxChars)) {
      if (current && current.length + piece.length + 1 > maxChars) flush()
      current = current ? `${current}\n${piece}` : piece
    }
    flush()
  }
  return chunks
}

/** Paragraphs, with long ones cut at sentence (or word) boundaries. */
function pieces(text: string, maxChars: number): string[] {
  const out: string[] = []
  for (const raw of text.split(/\n\s*\n/)) {
    const para = raw.replace(/[ \t]+/g, ' ').trim()
    if (!para) continue
    if (para.length <= maxChars) {
      out.push(para)
      continue
    }
    let rest = para
    while (rest.length > maxChars) {
      const window = rest.slice(0, maxChars)
      const cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('\n'))
      const at =
        cut > maxChars / 2
          ? cut + 1
          : window.lastIndexOf(' ') > 0
            ? window.lastIndexOf(' ')
            : maxChars
      out.push(rest.slice(0, at).trim())
      rest = rest.slice(at).trim()
    }
    if (rest) out.push(rest)
  }
  return out
}

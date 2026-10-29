/**
 * Server-sent events read from chunks as they arrive (a chunk can end anywhere): each complete
 * event goes to `onEvent` with its name ("message" when none) and its data lines joined.
 */
export function sseParser(onEvent: (event: string, data: string) => void) {
  let buffer = ''
  const flush = (block: string) => {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    }
    if (data.length > 0) onEvent(event, data.join('\n'))
  }
  return {
    push(chunk: string) {
      buffer += chunk
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ''
      for (const block of blocks) flush(block)
    },
    /** The last event when the stream ends without a blank line after it. */
    end() {
      if (buffer.trim()) flush(buffer)
      buffer = ''
    },
  }
}

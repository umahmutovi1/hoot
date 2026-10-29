import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { sseParser } from './sse'

const STREAM =
  'event: delta\ndata: {"text":"Ispit "}\n\n' +
  'event: delta\ndata: {"text":"je u petak."}\n\n' +
  'event: done\ndata: {"answer":"Ispit je u petak."}\n\n'

const read = (chunks: string[]) => {
  const events: [string, string][] = []
  const p = sseParser((e, d) => events.push([e, d]))
  for (const c of chunks) p.push(c)
  p.end()
  return events
}

describe('sseParser', () => {
  it('reads named events', () => {
    expect(read([STREAM])).toEqual([
      ['delta', '{"text":"Ispit "}'],
      ['delta', '{"text":"je u petak."}'],
      ['done', '{"answer":"Ispit je u petak."}'],
    ])
  })

  it('gives the same events however the stream is cut', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(STREAM.length), { maxLength: 8 }), (cuts) => {
        const at = [...new Set(cuts)].sort((a, b) => a - b)
        const chunks = [0, ...at].map((from, i) => STREAM.slice(from, at[i] ?? STREAM.length))
        expect(read(chunks)).toEqual(read([STREAM]))
      }),
    )
  })

  it('reads a last event without the closing blank line', () => {
    expect(read(['event: error\ndata: {"error":"failed"}'])).toEqual([
      ['error', '{"error":"failed"}'],
    ])
  })
})

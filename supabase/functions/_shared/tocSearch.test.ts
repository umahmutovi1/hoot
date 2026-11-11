import { describe, expect, it } from 'vitest'
import type { FindTocOutput } from './schemas'
import { keepToc, tocSearchKey, tocSearchRequest } from './tocSearch'

const req = { query: 'Haykin, Signals and Systems, 2. izdanje', locale: 'bs' as const }

const output = (over: Partial<FindTocOutput> = {}): FindTocOutput => ({
  units: [
    { label: '1', title: 'Introduction', page_start: 1, page_end: null },
    { label: '2.', title: ' Time-Domain   Representations ', page_start: 70, page_end: 60 },
    { label: '2', title: 'Duplicate', page_start: 80, page_end: null },
    { label: '3', title: 'Fourier Representations', page_start: 160, page_end: 283 },
  ],
  source_url: 'https://www.wiley.com/en-us/Signals+and+Systems-p-9780471164746',
  source_title: 'Signals and Systems, 2nd Edition | Wiley',
  site_kind: 'publisher',
  edition: 2,
  ...over,
})

const sources = [{ url: 'https://www.wiley.com/en-us/x', title: 'wiley.com' }]

describe('toc search', () => {
  it('one key per title, author and edition (case, spaces and punctuation do not matter)', () => {
    expect(tocSearchKey(req)).toBe(
      tocSearchKey({ ...req, query: 'haykin  signals and systems 2 izdanje' }),
    )
    expect(tocSearchKey(req)).not.toBe(
      tocSearchKey({ ...req, query: 'Haykin, Signals and Systems, 3. izdanje' }),
    )
  })

  it('sends only what the user typed, with web search on', () => {
    const r = tocSearchRequest(req)
    expect(r.task).toBe('find_toc')
    expect(r.webSearch).toEqual({ maxUses: 4 })
    expect(r.text.split('\n')).toEqual([
      'Book (title, author, edition as typed): Haykin, Signals and Systems, 2. izdanje',
      'User language: Bosnian',
    ])
  })

  it('keeps contents from a searched site, with unique labels and sane pages', () => {
    const toc = keepToc(output(), sources)
    expect(toc?.units).toEqual([
      { label: '1', title: 'Introduction', page_start: 1, page_end: null },
      { label: '2', title: 'Time-Domain Representations', page_start: 70, page_end: null },
      { label: '3', title: 'Fourier Representations', page_start: 160, page_end: 283 },
    ])
    expect(toc).toMatchObject({ site_kind: 'publisher', edition: 2 })
  })

  it('drops contents whose page was made up or is missing', () => {
    expect(keepToc(output({ source_url: 'https://made-up.example.org/toc' }), sources)).toBeNull()
    expect(keepToc(output({ source_url: null }), sources)).toBeNull()
    expect(keepToc(output({ source_url: 'http://www.wiley.com/x' }), sources)).toBeNull()
  })

  it('a single chapter is not a table of contents', () => {
    const one = output({
      units: [{ label: '1', title: 'About', page_start: null, page_end: null }],
    })
    expect(keepToc(one, sources)).toBeNull()
  })
})

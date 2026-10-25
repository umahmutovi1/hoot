import { describe, expect, it } from 'vitest'
import {
  academicSearchRequest,
  htmlToPages,
  isPublicHttps,
  keepFound,
  normalizeYear,
  searchKey,
} from './academicSearch'

const search = {
  op: 'search' as const,
  institution: 'Elektrotehnički fakultet  Sarajevo',
  program: 'Računarstvo i informatika',
  year_of_study: 2,
  academic_year: '2026/27',
  locale: 'bs' as const,
}

describe('academic search', () => {
  it('one key per faculty, programme, year and academic year (case and spaces do not matter)', () => {
    expect(searchKey(search)).toBe(
      searchKey({ ...search, institution: 'elektrotehnički fakultet sarajevo ' }),
    )
    expect(searchKey(search)).not.toBe(searchKey({ ...search, year_of_study: 3 }))
  })

  it('sends only the faculty, programme and year, with web search on', () => {
    const req = academicSearchRequest(search)
    expect(req.task).toBe('find_academic_info')
    expect(req.webSearch).toEqual({ maxUses: 4 })
    expect(req.text).toContain('Faculty: Elektrotehnički fakultet  Sarajevo')
    expect(req.text).toContain('Academic year: 2026/27')
    expect(req.text.split('\n')).toHaveLength(5)
  })

  it('keeps public https links from sites the search returned, once each', () => {
    const doc = (url: string) => ({
      kind: 'syllabus' as const,
      title: ' T ',
      url,
      academic_year: null,
    })
    const kept = keepFound(
      [
        doc('https://etf.unsa.ba/kalendar.pdf'),
        doc('https://etf.unsa.ba/kalendar.pdf'),
        doc('https://c2.etf.unsa.ba/silabus.pdf'),
        doc('http://etf.unsa.ba/x.pdf'),
        doc('https://made-up.example.org/plan.pdf'),
        doc('https://10.0.0.1/a.pdf'),
      ],
      // Anthropic gives the page URL; Gemini a redirect with the domain as title.
      [
        { url: 'https://www.etf.unsa.ba/studij', title: 'Studij' },
        {
          url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc',
          title: 'unsa.ba',
        },
      ],
    )
    expect(kept.map((d) => d.url)).toEqual([
      'https://etf.unsa.ba/kalendar.pdf',
      'https://c2.etf.unsa.ba/silabus.pdf',
    ])
    expect(kept[0]!.title).toBe('T')
    // Nothing to compare against: only the URL rules apply.
    expect(keepFound([doc('https://made-up.example.org/plan.pdf')], [])).toHaveLength(1)
  })

  it('url and year rules', () => {
    expect(isPublicHttps('https://localhost/x')).toBe(false)
    expect(isPublicHttps('https://intranet/x')).toBe(false)
    expect(isPublicHttps('https://unsa.ba/x')).toBe(true)
    expect(normalizeYear('2026/2027')).toBe('2026/27')
    expect(normalizeYear('2026-27')).toBe('2026/27')
    expect(normalizeYear('nije navedeno')).toBeNull()
  })

  it('an HTML page becomes text pages without scripts and tags', () => {
    const pages = htmlToPages(
      '<html><head><title>x</title><script>var a=1</script></head><body><h1>Plan</h1><p>Signali&nbsp;i sistemi &amp; Baze</p><table><tr><td>I parcijala</td><td>20</td></tr></table></body></html>',
    )
    expect(pages).toEqual([{ page: 1, text: 'Plan\nSignali i sistemi & Baze\nI parcijala | 20 |' }])
  })
})

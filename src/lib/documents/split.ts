import type { PageText } from './chunk'

/**
 * A long document in parts of at most `max` characters, cut between pages, each part starting
 * with the last page of the one before (a subject described across the cut is read whole once).
 * A page longer than `max` is cut to it. At most `limit` parts; the rest is not read.
 */
export function splitPages(pages: readonly PageText[], max: number, limit: number): PageText[][] {
  const fit = pages.map((p) => ({ page: p.page, text: p.text.slice(0, max) }))
  const parts: PageText[][] = []
  let i = 0
  while (i < fit.length && parts.length < limit) {
    const part: PageText[] = []
    let size = 0
    while (i < fit.length && size + fit[i]!.text.length <= max) {
      part.push(fit[i]!)
      size += fit[i]!.text.length
      i++
    }
    parts.push(part)
    // The next part repeats this part's last page, unless that page was the whole part.
    if (i < fit.length && part.length > 1) i--
  }
  return parts
}

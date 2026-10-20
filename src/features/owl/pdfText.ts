import type { PageText } from '@/lib/documents/chunk'

/** Average characters per page below which a PDF counts as scanned (no text layer). */
const MIN_CHARS_PER_PAGE = 40
export const MAX_PDF_PAGES = 200

/**
 * Text layer of a PDF, per page. pdf.js is loaded only when a PDF is picked.
 * Returns null for a scanned PDF, which then goes to the model as a file.
 */
export async function pdfText(file: File): Promise<PageText[] | null> {
  const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = worker.default
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdf = await task.promise
  try {
    const pages: PageText[] = []
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PDF_PAGES); n++) {
      const content = await (await pdf.getPage(n)).getTextContent()
      let text = ''
      for (const item of content.items) {
        if (!('str' in item)) continue
        text += item.str + (item.hasEOL ? '\n' : ' ')
      }
      pages.push({ page: n, text: text.replace(/[ \t]+\n/g, '\n').trim() })
    }
    const chars = pages.reduce((sum, p) => sum + p.text.length, 0)
    return chars / Math.max(pages.length, 1) < MIN_CHARS_PER_PAGE ? null : pages
  } finally {
    await task.destroy()
  }
}

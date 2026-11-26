import type { PageText } from '@/lib/documents/chunk'

/** Average characters per page below which a PDF counts as scanned (no text layer). */
const MIN_CHARS_PER_PAGE = 40
/** A textbook; longer PDFs are read up to here. */
export const MAX_TEXT_PAGES = 1500

export interface PdfPages {
  pages: PageText[]
  pageCount: number
  /** Page labels ("i", "ii", "1"); null when the PDF has none. */
  labels: string[] | null
  /** No text layer: the pages are images. */
  scanned: boolean
}

/**
 * Text of every page of a PDF, read in the browser (PRD "Tekst izvora": the file is never
 * uploaded). pdf.js is loaded only when a PDF is picked; `onPage` reports progress.
 */
export async function readPdfPages(
  file: File,
  onPage: (read: number, total: number) => void,
): Promise<PdfPages> {
  const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = worker.default
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdf = await task.promise
  try {
    const total = Math.min(pdf.numPages, MAX_TEXT_PAGES)
    const labels = await pdf.getPageLabels().catch(() => null)
    const pages: PageText[] = []
    for (let n = 1; n <= total; n++) {
      const page = await pdf.getPage(n)
      const content = await page.getTextContent()
      let text = ''
      for (const item of content.items) {
        if (!('str' in item)) continue
        text += item.str + (item.hasEOL ? '\n' : ' ')
      }
      page.cleanup()
      pages.push({ page: n, text: text.replace(/[ \t]+\n/g, '\n').trim() })
      if (n % 5 === 0 || n === total) onPage(n, total)
    }
    const chars = pages.reduce((sum, p) => sum + p.text.length, 0)
    return {
      pages,
      pageCount: pdf.numPages,
      labels,
      scanned: chars / Math.max(pages.length, 1) < MIN_CHARS_PER_PAGE,
    }
  } finally {
    await task.destroy()
  }
}

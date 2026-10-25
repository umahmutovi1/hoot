import type { PdfOutlineItem } from '@/lib/outline/pdf'

/** Most pages read for the table of contents when a PDF has no outline. */
const TOC_SCAN_PAGES = 20

export interface PdfInfo {
  pageCount: number
  /** Bookmarks with their PDF page (1-based); empty when the PDF has none. */
  outline: PdfOutlineItem[]
  /** Page labels ("i", "ii", "1"), null when the PDF has none. */
  labels: string[] | null
  /** Title from the PDF metadata, if any. */
  title: string | null
  /** Text of the first pages (for finding the table of contents). */
  firstPages: { page: number; text: string }[]
  /** Text of a page range (1-based, inclusive). */
  pagesText: (from: number, to: number) => Promise<string>
  close: () => Promise<void>
}

type OutlineNode = { title: string; dest: string | unknown[] | null; items: OutlineNode[] }

/**
 * Reads a PDF in the browser (PRD "Materijali": the file is never uploaded): page count, outline
 * with pages, page labels and title. pdf.js is loaded only when a PDF is picked.
 */
export async function readPdf(data: ArrayBuffer): Promise<PdfInfo> {
  const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = worker.default
  const task = getDocument({ data: new Uint8Array(data) })
  const pdf = await task.promise

  const pageOf = async (dest: OutlineNode['dest']): Promise<number | null> => {
    try {
      const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest
      const ref = explicit?.[0]
      if (ref == null) return null
      if (typeof ref === 'number') return ref + 1
      return (await pdf.getPageIndex(ref as never)) + 1
    } catch {
      return null
    }
  }
  const outline: PdfOutlineItem[] = []
  const walk = async (nodes: OutlineNode[], depth: number) => {
    for (const n of nodes) {
      outline.push({ title: n.title, depth, page: await pageOf(n.dest) })
      if (n.items?.length) await walk(n.items, depth + 1)
    }
  }
  await walk(((await pdf.getOutline()) ?? []) as OutlineNode[], 0)

  const textOf = async (n: number) => {
    const content = await (await pdf.getPage(n)).getTextContent()
    let text = ''
    for (const item of content.items) {
      if (!('str' in item)) continue
      text += item.str + (item.hasEOL ? '\n' : ' ')
    }
    return text.replace(/[ \t]+\n/g, '\n').trim()
  }
  const firstPages = []
  if (outline.length === 0)
    for (let n = 1; n <= Math.min(pdf.numPages, TOC_SCAN_PAGES); n++)
      firstPages.push({ page: n, text: await textOf(n) })

  const meta = (await pdf.getMetadata().catch(() => null)) as { info?: { Title?: string } } | null
  return {
    pageCount: pdf.numPages,
    outline,
    labels: await pdf.getPageLabels().catch(() => null),
    title: meta?.info?.Title?.trim() || null,
    firstPages,
    pagesText: async (from, to) => {
      const parts: string[] = []
      for (let n = Math.max(1, from); n <= Math.min(pdf.numPages, to); n++)
        parts.push(await textOf(n))
      return parts.join('\n')
    },
    close: () => task.destroy(),
  }
}

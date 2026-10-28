import { supabase } from '@/lib/supabase'
import type { PageText } from '@shared/schemas'
import type { DocumentInput } from './actions'
import { AiCallError, invokeAi } from './api'

type FetchedDocument =
  | { kind: 'file'; path: string; media_type: string; title: string }
  | { kind: 'text'; pages: PageText[]; title: string }

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * A found document, or any public link the user pasted, as a document for the assistant. The
 * server downloads it (the browser cannot, CORS): a PDF or an image comes back through Storage and
 * is removed there at once, a web page as its text.
 */
export async function documentFromLink(
  url: string,
): Promise<{ input: DocumentInput; title: string }> {
  const got = await invokeAi<FetchedDocument>('find-academic-info', { op: 'fetch', url })
  if (got.kind === 'text')
    return {
      input: { type: 'text', text: got.pages.map((p) => p.text).join('\n\n') },
      title: got.title,
    }
  const { data } = await supabase.storage.from('uploads').download(got.path)
  await supabase.storage.from('uploads').remove([got.path])
  if (!data) throw new AiCallError('failed')
  const name = `${got.title.slice(0, 80)}.${EXTENSIONS[got.media_type] ?? 'pdf'}`
  return {
    input: { type: 'file', file: new File([data], name, { type: got.media_type }) },
    title: got.title,
  }
}

import { lazy, Suspense } from 'react'

const Markdown = lazy(() => import('./Markdown'))

export function LazyMarkdown({ children }: { children: string }) {
  return (
    <Suspense fallback={<p className="text-sm whitespace-pre-wrap">{children}</p>}>
      <Markdown>{children}</Markdown>
    </Suspense>
  )
}

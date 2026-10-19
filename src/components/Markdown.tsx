import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

/**
 * Notes and answers: Markdown with $inline$ and $$block$$ math. Loaded lazily through
 * LazyMarkdown so KaTeX stays out of the main bundle. Raw HTML is not rendered.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown text-sm leading-normal">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

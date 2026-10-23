import { useState } from 'react'
import { AiCallError } from '@/features/owl/api'
import { useAuth } from '@/features/auth/auth-context'
import { useLocale } from '@/features/settings/useLocale'
import { fromAi, withRatings } from '@/lib/outline/ai'
import type { Measure, ParsedOutline } from '@/lib/outline/parse'
import type { SourceForm } from './schemas'
import { parseQuestions, parseToc, subjectTopicNames, uploadImportFile } from './importApi'

export interface AiResult {
  outline: ParsedOutline
  /** label → topic names */
  topics: Record<string, string[]>
  /** The model's own notes (unreadable page, uncertain label), in the user's language. */
  warnings: string[]
}

export type AiImportInput =
  | { kind: 'files'; files: File[] }
  | { kind: 'text'; text: string }
  /** "Procijeni težinu AI-jem": the reviewed outline gets difficulty and topics. */
  | { kind: 'rate'; outline: ParsedOutline }

/** Calls parse-toc / parse-questions and turns the answer into a reviewable outline. */
export function useAiImport(subject: { id: string; name: string }) {
  const userId = useAuth().session?.user.id
  const { locale } = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (
    form: Pick<SourceForm, 'kind' | 'title'>,
    measure: Measure,
    input: AiImportInput,
  ): Promise<AiResult | null> => {
    if (!userId || busy) return null
    setBusy(true)
    setError(null)
    try {
      const topics = await subjectTopicNames(subject.id)
      const files =
        input.kind === 'files'
          ? await Promise.all(input.files.map((f) => uploadImportFile(userId, f)))
          : []
      const text = input.kind === 'text' ? input.text : null
      const base = { subject: subject.name, locale, files, text, topics }
      if (measure === 'questions') {
        const out = await parseQuestions(base)
        const ai = fromAi(out.questions, measure)
        return { ...ai, warnings: out.warnings }
      }
      const out = await parseToc({
        ...base,
        source_kind: form.kind === 'questions' ? 'other' : form.kind,
        measure,
        title: form.title,
        units:
          input.kind === 'rate'
            ? input.outline.units.map((u) => ({ label: u.label, title: u.title }))
            : null,
      })
      if (input.kind === 'rate') return { ...withRatings(input.outline, out.units), warnings: [] }
      return { ...fromAi(out.units, measure), warnings: out.warnings }
    } catch (err) {
      setError(err instanceof AiCallError ? err.code : 'failed')
      return null
    } finally {
      setBusy(false)
    }
  }

  return { run, busy, error }
}

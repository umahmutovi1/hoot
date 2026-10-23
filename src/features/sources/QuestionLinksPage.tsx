import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScreenTitle } from '@/components/ScreenTitle'
import { SplashScreen } from '@/components/SplashScreen'
import { Button } from '@/components/ui/button'
import { AiCallError } from '@/features/owl/api'
import { useQuestionLinks } from '@/features/plan/api'
import { useSubject } from '@/features/subjects/api'
import { cn } from '@/lib/utils'
import { useSources } from './api'
import { useLinkSuggestions, useSaveLinks } from './linksApi'
import { partialExams, type Unit } from './model'

/**
 * Veze s poglavljima: after a question list is imported, the AI suggests the chapter(s) each
 * question belongs to; the user skips what is wrong and saves. Questions that already have a
 * direct link (or a rejected one) are not asked about again.
 */
export function QuestionLinksPage() {
  const { id, sourceId } = useParams()
  const { data: subject, isPending } = useSubject(id)
  const { data: sources, isPending: sourcesPending } = useSources(id)
  const { data: links } = useQuestionLinks()
  if (isPending || sourcesPending || !links) return <SplashScreen />
  const source = sources?.find((s) => s.id === sourceId)
  if (!subject || !source) return <Navigate to={id ? `/subjects/${id}` : '/subjects'} replace />
  const linked = new Set(links.map((l) => l.question_id))
  const questions = source.units.filter(
    (u) => u.kind === 'question' && u.archived_at === null && !linked.has(u.id),
  )
  const chapters = (sources ?? [])
    .filter((s) => !s.is_rough)
    .flatMap((s) => s.units.filter((u) => u.kind === 'chapter'))
  const next =
    partialExams(subject.assessments).length > 0
      ? `/subjects/${subject.id}/scope?source=${source.id}`
      : `/subjects/${subject.id}/sources/${source.id}`
  return <Review questions={questions} chapters={chapters} next={next} />
}

function Review({
  questions,
  chapters,
  next,
}: {
  questions: Unit[]
  chapters: Unit[]
  next: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ids = useMemo(() => questions.map((q) => q.id), [questions])
  const suggest = useLinkSuggestions(ids)
  const save = useSaveLinks()
  const [skipped, setSkipped] = useState<Set<string>>(new Set())

  const byId = new Map([...questions, ...chapters].map((u) => [u.id, u]))
  const rows = (suggest.data ?? []).filter((l) => byId.has(l.question_id) && byId.has(l.unit_id))
  const key = (l: { question_id: string; unit_id: string }) => `${l.question_id}:${l.unit_id}`
  const accepted = rows.filter((l) => !skipped.has(key(l))).length
  const done = () => navigate(next, { replace: true })
  const errorCode = suggest.error instanceof AiCallError ? suggest.error.code : 'failed'

  return (
    <div className="flex flex-col gap-3.5">
      <ScreenTitle title={t('links.title')} />
      <span className="text-[13px] text-ink-muted">{t('links.lead')}</span>

      {suggest.isPending ? (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">{t('links.searching')}</p>
      ) : suggest.isError ? (
        <p role="alert" className="rounded-card glass p-4 text-sm text-danger">
          {t(`owl.error.${errorCode as 'failed'}`)}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">{t('links.none')}</p>
      ) : (
        <div className="flex flex-col rounded-card glass p-1.5">
          {rows.map((l, i) => {
            const q = byId.get(l.question_id)!
            const c = byId.get(l.unit_id)!
            const off = skipped.has(key(l))
            return (
              <div
                key={key(l)}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-3',
                  i < rows.length - 1 && 'border-b border-canvas',
                  off && 'opacity-55',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-brand uppercase">
                    {off ? t('links.skipped') : t('links.suggested')}
                  </span>
                  <span className="text-sm leading-[1.3] font-medium">
                    {q.label ? `${q.label} · ` : ''}
                    {q.title}
                  </span>
                  <span className="text-xs text-ink-muted">
                    → {c.label ? `${c.label} ` : ''}
                    {c.title}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSkipped((s) => {
                      const n = new Set(s)
                      if (off) n.delete(key(l))
                      else n.add(key(l))
                      return n
                    })
                  }
                  aria-label={t(off ? 'links.restoreAria' : 'links.skipAria', {
                    label: q.label ?? q.title,
                  })}
                  className="h-11 shrink-0 rounded-full bg-white/60 px-3.5 text-[13px] font-semibold text-brand"
                >
                  {t(off ? 'links.restore' : 'links.skip')}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {rows.length > 0 && (
        <Button
          type="button"
          size="pill"
          disabled={save.isPending}
          className="mt-2 btn-primary"
          onClick={async () => {
            await save.mutateAsync(rows.map((l) => ({ ...l, accept: !skipped.has(key(l)) })))
            done()
          }}
        >
          {t('links.save', { count: accepted })}
        </Button>
      )}
      <Button type="button" variant="link" className="h-11 text-brand" onClick={done}>
        {t(rows.length > 0 ? 'links.later' : 'links.continue')}
      </Button>
    </div>
  )
}

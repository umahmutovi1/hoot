import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useScope, useSources } from '@/features/sources/api'
import { materialOf, toScopeRows } from '@/features/sources/model'
import { cn } from '@/lib/utils'
import { sourceState, type SourceChoice } from './sourceScope'
import { fieldLabel } from './fields'

/** "Izvori za ovaj ispit" in ExamSheet; changes are kept by the form and saved with the exam. */
export function ExamSources({
  subjectId,
  exam,
  choices,
  onChange,
  isNew,
}: {
  subjectId: string
  exam: { id: string; scopeAll: boolean }
  choices: Record<string, SourceChoice>
  onChange: (sourceId: string, choice: SourceChoice) => void
  isNew: boolean
}) {
  const { t } = useTranslation()
  const { data: sources = [] } = useSources(subjectId)
  const { data: scope = [] } = useScope(subjectId)
  const materials = sources.map(materialOf).filter((m) => m.units.length > 0)
  const rows = toScopeRows(scope)

  return (
    <div className="flex flex-col gap-2">
      <span className={fieldLabel}>{t('exams.sources.label')}</span>
      {materials.length === 0 ? (
        <p className="rounded-[16px] bg-canvas px-4 py-3 text-sm text-ink-muted">
          {t('exams.sources.none')}{' '}
          <Link to={`/subjects/${subjectId}/sources/new`} className="font-semibold text-brand">
            {t('exams.sources.add')} ›
          </Link>
        </p>
      ) : (
        materials.map((m) => {
          const state = choices[m.source.id] ?? sourceState(m, exam, rows)
          return (
            <div
              key={m.source.id}
              className="flex items-center gap-2.5 rounded-[16px] bg-canvas py-2 pr-2 pl-4"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{m.source.title}</span>
                {state === 'part' && (
                  <Link
                    to={`/subjects/${subjectId}/scope`}
                    className="text-xs font-semibold text-brand"
                  >
                    {t('exams.sources.part')} ›
                  </Link>
                )}
              </div>
              <div role="radiogroup" className="flex shrink-0 rounded-full bg-surface p-0.5">
                {(['all', 'none'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={state === c}
                    onClick={() => onChange(m.source.id, c)}
                    className={cn(
                      'h-9 rounded-full px-3 text-xs font-semibold',
                      state === c ? 'bg-brand text-white' : 'text-ink-muted',
                    )}
                  >
                    {t(c === 'all' ? 'exams.sources.all' : 'exams.sources.none_choice')}
                  </button>
                ))}
              </div>
            </div>
          )
        })
      )}
      {materials.length > 0 && (
        <span className="text-xs leading-[1.4] text-ink-muted">
          {t(isNew ? 'exams.sources.hintNew' : 'exams.sources.hint')}
        </span>
      )}
    </div>
  )
}

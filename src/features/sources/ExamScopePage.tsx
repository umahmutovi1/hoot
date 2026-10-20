import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BackHeader } from '@/components/BackHeader'
import { SplashScreen } from '@/components/SplashScreen'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/features/settings/useLocale'
import { useSubject } from '@/features/subjects/api'
import type { Assessment, SubjectWithAssessments } from '@/features/subjects/model'
import { dateFnsLocales } from '@/lib/locale'
import { leavesOf } from '@/lib/progress'
import {
  choiceOf,
  rowsForChoice,
  scopeOf,
  type ScopeChoice,
  type ScopeExam,
  type ScopeRow,
} from '@/lib/progress/scope'
import { cn } from '@/lib/utils'
import { useSaveScope, useScope, useSources } from './api'
import { formatDuration, pagesLabel } from './format'
import {
  asProgress,
  materialOf,
  measureOf,
  partialExams,
  shortExamLabel,
  toScopeRows,
  type AssessmentUnit,
  type SourceMaterial,
} from './model'
import { goBack } from '@/app/navigation'

/** ObimIspita: which top-level unit of each source goes into which exam. */
export function ExamScopePage() {
  const { id } = useParams()
  const { data: subject, isPending } = useSubject(id)
  const { data: sources, isPending: sourcesPending } = useSources(id)
  const { data: scope, isPending: scopePending } = useScope(id)
  if (isPending || sourcesPending || scopePending) return <SplashScreen />
  if (!subject) return <Navigate to="/subjects" replace />
  return (
    <ScopeEditor
      subject={subject}
      materials={(sources ?? []).map(materialOf)}
      stored={scope ?? []}
    />
  )
}

type Segment = { key: string; label: string; choice: ScopeChoice }

function sameChoice(a: ScopeChoice, b: ScopeChoice) {
  if (a.kind !== b.kind) return false
  if (a.kind !== 'exams' || b.kind !== 'exams') return true
  return a.examIds.join() === b.examIds.join()
}

function ScopeEditor({
  subject,
  materials,
  stored,
}: {
  subject: SubjectWithAssessments
  materials: SourceMaterial[]
  stored: AssessmentUnit[]
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const save = useSaveScope(subject.id)
  const [params] = useSearchParams()
  const withUnits = materials.filter((m) => m.units.length > 0)
  const [sourceId, setSourceId] = useState(
    () =>
      withUnits.find((m) => m.source.id === params.get('source'))?.source.id ??
      withUnits[0]?.source.id,
  )

  const exams = useMemo(
    () => [...subject.assessments].sort((a, b) => a.at.localeCompare(b.at)),
    [subject.assessments],
  )
  const scopeExams: ScopeExam[] = exams.map((e) => ({ id: e.id, scopeAll: e.scope_all }))
  const partials = partialExams(exams)
  const hasScopeAll = exams.some((e) => e.scope_all)
  const storedRows = useMemo(() => toScopeRows(stored), [stored])
  const assignedBy = new Map(stored.map((r) => [r.unit_id, r.assigned_by]))
  const [draft, setDraft] = useState<Map<string, ScopeChoice>>(new Map())

  const choice = (unitId: string) => draft.get(unitId) ?? choiceOf(unitId, scopeExams, storedRows)
  const rows: ScopeRow[] = [
    ...storedRows.filter((r) => !draft.has(r.unitId)),
    ...[...draft].flatMap(([unitId, c]) => rowsForChoice(unitId, scopeExams, c)),
  ]

  const segments: Segment[] =
    partials.length === 0
      ? [
          { key: 'in', label: t('scope.included'), choice: { kind: 'unassigned' } },
          { key: 'none', label: t('scope.excluded'), choice: { kind: 'excluded' } },
        ]
      : [
          ...partials.map((e) => ({
            key: e.id,
            label: shortExamLabel(e.title),
            choice: { kind: 'exams', examIds: [e.id] } as ScopeChoice,
          })),
          ...(partials.length > 1
            ? [
                {
                  key: 'all',
                  label: t('scope.all'),
                  choice: { kind: 'exams', examIds: partials.map((e) => e.id) } as ScopeChoice,
                },
              ]
            : []),
          { key: 'none', label: t('scope.excluded'), choice: { kind: 'excluded' } },
        ]

  const allUnits = materials.flatMap((m) => asProgress(m.units))
  const leaves = leavesOf(allUnits)
  const summary = (exam: Assessment) => {
    const inScope = scopeOf({ id: exam.id, scopeAll: exam.scope_all }, allUnits, rows)
    const items = materials
      .flatMap((m) => m.units)
      .filter((u) => u.parent_id === null && inScope.has(u.id)).length
    const minutes = leaves.filter((l) => inScope.has(l.id)).reduce((s, l) => s + l.minutes, 0)
    return t('scope.summary', { count: items, time: formatDuration(t, minutes) })
  }

  const current = withUnits.find((m) => m.source.id === sourceId)
  const top = current?.units.filter((u) => u.parent_id === null) ?? []
  const back = () => goBack(navigate, `/subjects/${subject.id}`)

  return (
    <div className="flex flex-col gap-3.5">
      <BackHeader title={t('scope.title')} fallback={`/subjects/${subject.id}`} />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-[1.2] font-bold">{t('scope.heading')}</h1>
        <span className="text-[13px] text-ink-muted">{t('scope.lead')}</span>
      </div>

      {withUnits.length === 0 ? (
        <p className="rounded-card bg-surface p-4 text-sm text-ink-muted">{t('scope.noUnits')}</p>
      ) : (
        <>
          {partials.length > 0 && (
            <div className="grid grid-cols-2 gap-x-2 gap-y-3 rounded-[20px] bg-surface px-3.5 py-3">
              {partials.map((e) => (
                <div key={e.id} className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-xs font-semibold text-brand uppercase">
                    {e.title} ·{' '}
                    {format(new Date(e.at), 'd. MMM', { locale: dateFnsLocales[locale] })}
                  </span>
                  <span className="text-sm font-semibold">{summary(e)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-ink-muted uppercase">
              {t('scope.source')}
            </span>
            <div role="tablist" className="flex flex-wrap gap-1.5">
              {withUnits.map((m) => (
                <button
                  key={m.source.id}
                  type="button"
                  role="tab"
                  aria-selected={m.source.id === sourceId}
                  onClick={() => setSourceId(m.source.id)}
                  className={cn(
                    'h-[38px] rounded-full px-3.5 text-[13px] font-semibold',
                    m.source.id === sourceId ? 'bg-ink text-white' : 'bg-surface',
                  )}
                >
                  {t(`sources.kind.${m.source.kind}`)} ·{' '}
                  {m.units.filter((u) => u.parent_id === null).length}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3.5 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Tag by="ai" />
              {t('scope.legendAi')}
            </span>
            <span className="flex items-center gap-1.5">
              <Tag by="user" />
              {t('scope.legendUser')}
            </span>
            {hasScopeAll && <span>{t('scope.legendAll')}</span>}
          </div>

          <div className="flex flex-col rounded-card bg-surface p-1.5">
            {top.map((u, i) => {
              const c = choice(u.id)
              const by = draft.has(u.id) ? 'user' : assignedBy.get(u.id)
              return (
                <div
                  key={u.id}
                  className={cn(
                    'flex flex-col gap-2 px-2.5 py-3',
                    i < top.length - 1 && 'border-b border-canvas',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="min-w-[30px] text-[13px] font-semibold text-ink-muted">
                      {u.label}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm leading-[1.3] font-medium">{u.title}</span>
                      <span className="text-[11px] text-ink-subtle">
                        {c.kind === 'unassigned' && partials.length > 0
                          ? t(hasScopeAll ? 'scope.unassignedAll' : 'scope.unassigned')
                          : pagesLabel(t, measureOf(current!.source), u)}
                      </span>
                    </span>
                    {by && <Tag by={by} />}
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={t('scope.unitExams', { label: u.label ?? u.title })}
                    className="ml-[38px] flex rounded-[14px] bg-canvas p-[3px]"
                  >
                    {segments.map((s) => {
                      const on = sameChoice(c, s.choice)
                      return (
                        <button
                          key={s.key}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setDraft((d) => new Map(d).set(u.id, s.choice))}
                          className={cn(
                            'h-[30px] min-w-0 flex-1 truncate rounded-[11px] px-1 text-xs font-semibold',
                            on ? 'bg-surface text-brand-strong' : 'text-ink-muted',
                          )}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <Button
        type="button"
        size="pill"
        className="mt-2 bg-brand text-white hover:bg-brand-strong"
        onClick={() => {
          const unitIds = [...draft.keys()]
          if (unitIds.length > 0) {
            save.mutate({
              unitIds,
              examIds: exams.map((e) => e.id),
              rows: unitIds.flatMap((id) => rowsForChoice(id, scopeExams, draft.get(id)!)),
            })
          }
          back()
        }}
      >
        {t('common.save')}
      </Button>
    </div>
  )
}

function Tag({ by }: { by: AssessmentUnit['assigned_by'] }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'shrink-0 rounded-[6px] px-1.5 py-0.5 text-[10px] font-bold',
        by === 'user'
          ? 'bg-success-soft text-success'
          : 'bg-subject-blue-soft text-subject-blue-deep',
      )}
    >
      {t(by === 'user' ? 'scope.tagUser' : 'scope.tagAi')}
    </span>
  )
}

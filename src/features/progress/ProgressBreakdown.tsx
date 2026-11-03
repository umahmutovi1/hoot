import { BAND_BG, BANDS } from '@/features/review/bands'
import { strengthBand } from '@/lib/srs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { asProgress, materialOf, rateOf, subjectMaterialProgress } from '@/features/sources/model'
import { subtreeLeaves } from '@/lib/progress'
import { examProgress, partialExams, scopeExamOf, toScopeRows } from '@/features/sources/model'
import { roughScopeRows } from '@/features/plan/state'
import { supabase } from '@/lib/supabase'
import { useProgress } from './useProgress'

export function ProgressBreakdown() {
  const { t } = useTranslation()
  const data = useProgress()
  const userId = useAuth().session?.user.id
  const { data: topics = [] } = useQuery({
    queryKey: ['progress', userId, 'topics'],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('topics').select('*')
      if (error) throw error
      return data
    },
  })
  const [filter, setFilter] = useState('all')
  if (!data) return null
  const subjects = data.inputs.subjects.filter((s) => !s.archived)
  const topicRows = topics
    .filter((topic) => filter === 'all' || topic.subject_id === filter)
    .map((topic) => {
      const linked = data.inputs.unitTopics
        .filter((l) => l.topic_id === topic.id)
        .map((l) => l.unit_id)
      const ids = [
        ...new Set(
          data.inputs.sources.flatMap((source) => {
            const material = materialOf(source, rateOf(source, data.inputs.sources).mean)
            return linked.flatMap((id) =>
              subtreeLeaves(asProgress(material.units), id).map((u) => u.id),
            )
          }),
        ),
      ]
      return { topic, progress: data.progress(ids), strength: data.strength(ids) }
    })
    .sort((a, b) => (a.strength ?? 2) - (b.strength ?? 2))
  return (
    <>
      <section className="glass flex flex-col gap-3 rounded-card p-4">
        <h2 className="text-base font-semibold">{t('progress.breakdown.title')}</h2>
        {subjects.map((s) => {
          const sources = data.inputs.sources.filter((x) => x.subject_id === s.id)
          const materials = sources.map((x) => materialOf(x, rateOf(x, data.inputs.sources).mean))
          return (
            <details key={s.id} className="border-b border-hairline last:border-0">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-semibold">
                <span>{s.name}</span>
                <span>{Math.round(subjectMaterialProgress(materials) * 100)}%</span>
              </summary>
              <div className="flex flex-col gap-2 pb-3">
                {materials.map((m) => (
                  <ProgressRow
                    key={m.source.id}
                    label={m.source.title}
                    fraction={m.progress.fraction}
                    to={`/subjects/${s.id}/sources/${m.source.id}`}
                  />
                ))}
                {s.assessments
                  .filter((a) => !a.archived_at)
                  .map((exam) => {
                    const rows = toScopeRows(data.inputs.scope)
                    const inferred = materials
                      .filter((m) => m.source.is_rough)
                      .flatMap((m) => roughScopeRows(m.units, partialExams(s.assessments), rows))
                    return (
                      <ProgressRow
                        key={exam.id}
                        label={exam.title}
                        fraction={
                          examProgress(scopeExamOf(exam, s.assessments), materials, [
                            ...rows,
                            ...inferred,
                          ]).fraction
                        }
                        to={`/subjects/${s.id}`}
                      />
                    )
                  })}
                {!sources.length && (
                  <p className="text-xs text-ink-muted">{t('progress.forecast.noScope')}</p>
                )}
              </div>
            </details>
          )
        })}
      </section>
      <section className="glass flex flex-col gap-3 rounded-card p-4">
        <h2 className="text-base font-semibold">{t('progress.topics.title')}</h2>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={t('progress.topics.filter')}
        >
          {[{ id: 'all', name: t('progress.topics.all') }, ...subjects].map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={filter === s.id}
              onClick={() => setFilter(s.id)}
              className={`min-h-11 rounded-full px-3 text-xs ${filter === s.id ? 'bg-ink text-white' : 'bg-white/40'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
        {topicRows.map(({ topic, progress, strength }) => (
          <div key={topic.id} className="flex flex-col gap-1.5">
            <ProgressRow
              label={topic.name}
              fraction={progress.fraction}
              to={`/subjects/${topic.subject_id}`}
            />
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span>{t('progress.topics.strength')}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-track">
                <div
                  className={`h-full ${strength === null ? '' : BAND_BG[strengthBand(strength)]}`}
                  style={{ width: `${(strength ?? 0) * 100}%` }}
                />
              </div>
              <span>{strength === null ? '—' : `${Math.round(strength * 100)}%`}</span>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
          {BANDS.map((band) => (
            <span key={band} className="flex items-center gap-1">
              <span className={`size-2 rounded-sm ${BAND_BG[band]}`} />
              {t(`strength.band.${band}`)}
            </span>
          ))}
        </div>
        {!topicRows.length && (
          <p className="text-sm text-ink-muted">{t('progress.topics.empty')}</p>
        )}
      </section>
    </>
  )
}
function ProgressRow({ label, fraction, to }: { label: string; fraction: number; to: string }) {
  return (
    <Link to={to} className="flex min-h-11 items-center gap-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-track">
        <span className="block h-full bg-brand-accent" style={{ width: `${fraction * 100}%` }} />
      </span>
      <span className="w-10 text-right">{Math.round(fraction * 100)}%</span>
    </Link>
  )
}

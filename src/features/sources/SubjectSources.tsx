import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArchiveIcon } from '@/components/icons'
import { SwipeRow } from '@/components/SwipeRow'
import { useToast } from '@/components/toast-store'
import { useArchiveSource, useArchivedSources } from './api'
import { leavesOf, levelMinutes } from '@/lib/progress'
import { cn } from '@/lib/utils'
import { amountLabel } from './format'
import { LevelBar } from './LevelBar'
import { asProgress, measureOf, type SourceMaterial } from './model'

/**
 * "Izvori" on Predmet: one card per source with its progress bar. Swipe left archives a source
 * (Stage 10b: nothing with units on it is deleted); archived ones are listed below to restore.
 */
export function SubjectSources({
  subjectId,
  materials,
}: {
  subjectId: string
  materials: SourceMaterial[]
}) {
  const { t } = useTranslation()
  const archive = useArchiveSource(subjectId)
  const show = useToast((s) => s.show)
  const archiveSource = (id: string) => {
    archive.mutate({ id, archived: true })
    show(t('swipe.sourceArchived'), {
      label: t('today.cant.undo'),
      run: () => archive.mutate({ id, archived: false }),
    })
  }
  return (
    <>
      <div className="mt-1.5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('sources.section')}</h2>
        <Link
          to={`/subjects/${subjectId}/sources/new`}
          className="flex h-9 items-center rounded-full glass px-3 text-[13px] font-semibold text-brand"
        >
          {t('sources.add')}
        </Link>
      </div>
      {materials.length === 0 ? (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">{t('sources.none')}</p>
      ) : (
        materials
          // A rough source whose parts were archived (real content arrived) is gone.
          .filter((m) => !m.source.is_rough || m.units.some((u) => !u.archived_at))
          .map((m) => (
            <SwipeRow
              key={m.source.id}
              className="rounded-card"
              actions={[
                {
                  id: 'archive',
                  label: t('swipe.archive'),
                  tone: 'archive',
                  icon: <ArchiveIcon size={18} />,
                  run: () => archiveSource(m.source.id),
                },
              ]}
            >
              <SourceCard subjectId={subjectId} material={m} />
            </SwipeRow>
          ))
      )}
      <ArchivedSources subjectId={subjectId} />
    </>
  )
}

function ArchivedSources({ subjectId }: { subjectId: string }) {
  const { t } = useTranslation()
  const { data: archived = [] } = useArchivedSources(subjectId)
  const restore = useArchiveSource(subjectId)
  const show = useToast((s) => s.show)
  if (archived.length === 0) return null
  return (
    <details className="group rounded-card glass px-4 py-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink-secondary">
        {t('swipe.archivedSources')} ({archived.length})
      </summary>
      <div className="flex flex-col pb-2">
        {archived.map((s) => (
          <div key={s.id} className="flex min-h-11 items-center justify-between gap-3">
            <span className="truncate text-[15px] text-ink-muted">{s.title}</span>
            <button
              type="button"
              onClick={() => {
                restore.mutate({ id: s.id, archived: false })
                show(t('swipe.sourceRestored'))
              }}
              className="flex h-9 shrink-0 items-center rounded-full bg-canvas px-3 text-[13px] font-semibold text-brand"
            >
              {t('swipe.restore')}
            </button>
          </div>
        ))}
      </div>
    </details>
  )
}

function SourceCard({ subjectId, material }: { subjectId: string; material: SourceMaterial }) {
  const { t } = useTranslation()
  const { source } = material
  const measure = measureOf(source)
  const questions = source.kind === 'questions'
  const leaves = leavesOf(asProgress(material.units))
  const amount = leaves.reduce(
    (s, l) => s + Number(material.units.find((u) => u.id === l.id)?.amount ?? 0),
    0,
  )
  const known = leaves.filter((l) => l.level === 3).length

  return (
    <Link
      to={`/subjects/${subjectId}/sources/${source.id}`}
      className="flex flex-col gap-2.5 rounded-card glass p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              'text-xs uppercase',
              questions ? 'text-subject-blue-deep' : 'text-brand-muted',
            )}
          >
            {source.is_rough ? t('sources.rough.label') : t(`sources.kind.${source.kind}`)}
            {leaves.length > 0 && ` · ${amountLabel(t, measure, amount)}`}
          </span>
          <span className="text-[15px] font-semibold">{source.title}</span>
          {source.is_rough && (
            <span className="text-xs text-ink-muted">{t('sources.rough.hint')}</span>
          )}
        </div>
        <span className="shrink-0 text-[15px] font-bold">
          {questions
            ? `${known}/${leaves.length}`
            : `${Math.round(material.progress.fraction * 100)}%`}
        </span>
      </div>
      <LevelBar minutes={levelMinutes(leaves)} questions={questions} className="h-2.5" />
    </Link>
  )
}

/** Progress ring in the subject hero (Predmet mockup). */
export function ProgressRing({
  fraction,
  strokeClass,
  textClass,
}: {
  fraction: number
  strokeClass: string
  textClass: string
}) {
  const r = 44
  const c = 2 * Math.PI * r
  const pct = Math.round(fraction * 100)
  return (
    <div className="relative size-24 shrink-0">
      <svg width="96" height="96" viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="52" r={r} fill="none" strokeWidth="12" className="stroke-surface" />
        {pct > 0 && (
          <circle
            cx="52"
            cy="52"
            r={r}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(c * pct) / 100} ${c}`}
            transform="rotate(-90 52 52)"
            className={strokeClass}
          />
        )}
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-[22px] font-bold',
          textClass,
        )}
      >
        {pct}%
      </span>
    </div>
  )
}

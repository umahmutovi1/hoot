import { DocIcon } from '@/components/icons'
import { useRates } from '@/features/plan/api'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SplashScreen } from '@/components/SplashScreen'
import { useSubject } from '@/features/subjects/api'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import { levelMinutes, leavesOf, subtreeLeaves } from '@/lib/progress'
import { scopeOf } from '@/lib/progress/scope'
import { cn } from '@/lib/utils'
import { useScope, useSource, useUpdateUnit } from './api'
import { formatDuration, pagesLabel, STATUS_CHIP, statusLabel } from './format'
import { LevelBar } from './LevelBar'
import {
  archivedUnits,
  asProgress,
  materialOf,
  measureOf,
  partialExams,
  toScopeRows,
  type SourceMaterial,
  type SourceWithUnits,
} from './model'

/** Izvor: progress of one source and its units; archived units can be restored. */
export function SourcePage() {
  const { id, sourceId } = useParams()
  const { data: subject, isPending } = useSubject(id)
  const { data: source, isPending: sourcePending } = useSource(id, sourceId)
  if (isPending || sourcePending) return <SplashScreen />
  if (!subject) return <Navigate to="/subjects" replace />
  if (!source) return <Navigate to={`/subjects/${subject.id}`} replace />
  return <SourceDetail subject={subject} source={source} />
}

function SourceDetail({
  subject,
  source,
}: {
  subject: SubjectWithAssessments
  source: SourceWithUnits
}) {
  const { t } = useTranslation()
  const rates = useRates()
  const material = materialOf(source, rates.get(source.id))
  const measure = measureOf(source)
  const leaves = leavesOf(asProgress(material.units))
  const base = `/subjects/${subject.id}/sources/${source.id}`
  const { data: scope = [] } = useScope(subject.id)
  const partials = partialExams(subject.assessments)
  const [filter, setFilter] = useState<string>('all')
  const exam = partials.find((e) => e.id === filter)
  const visible = exam
    ? scopeOf({ id: exam.id, scopeAll: false }, asProgress(material.units), toScopeRows(scope))
    : null

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-end">
        <Link
          to={`${base}/edit`}
          className="flex h-11 items-center rounded-full glass px-4 text-sm font-semibold"
        >
          {t('sources.detail.editContent')}
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-brand-muted">
          {subject.name} · {t(`sources.kind.${source.kind}`)}
        </span>
        <h1 className="text-[26px] leading-[1.15] font-bold">{source.title}</h1>
      </div>

      {source.file_name && (
        // Where the units came from (Stage 10c): the PDF's name, and the Drive link when picked there.
        <div className="flex items-center gap-3 rounded-[20px] glass p-3">
          <span
            aria-hidden="true"
            className="icon-tile flex size-10 shrink-0 items-center justify-center rounded-[12px]"
          >
            <DocIcon size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold">{source.file_name}</span>
            <span className="text-xs text-ink-muted">
              {t(source.drive_file_id ? 'sources.pdf.originDrive' : 'sources.pdf.originDevice')}
            </span>
          </span>
          {source.external_url && (
            <a
              href={source.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 shrink-0 items-center px-1 text-[13px] font-semibold text-brand"
            >
              {t('sources.pdf.openDrive')}
            </a>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-card glass p-4">
        <LevelBar
          minutes={levelMinutes(leaves)}
          questions={source.kind === 'questions'}
          className="h-3.5"
        />
        <div className="grid grid-cols-3 gap-2">
          <Stat
            value={`${Math.round(material.progress.fraction * 100)}%`}
            label={t('sources.detail.done')}
          />
          <Stat
            value={`~${formatDuration(t, material.progress.remainingMinutes)}`}
            label={t('sources.detail.remaining')}
          />
          <Stat
            value={formatRate(Number(source.base_min_per_unit))}
            label={t(`sources.detail.rate.${measure}`)}
          />
        </div>
      </div>

      {partials.length > 0 && material.units.length > 0 && (
        <div role="group" aria-label={t('sources.detail.filter')} className="flex flex-wrap gap-2">
          {[{ id: 'all', title: t('sources.detail.all') }, ...partials].map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'h-[38px] rounded-full px-3.5 text-[13px] font-semibold',
                filter === f.id ? 'bg-ink text-white' : 'glass',
              )}
            >
              {f.title}
            </button>
          ))}
        </div>
      )}

      {material.units.length === 0 ? (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">{t('sources.detail.empty')}</p>
      ) : (
        <UnitList material={material} base={base} visible={visible} />
      )}

      <Archived subjectId={subject.id} source={source} />
    </div>
  )
}

function formatRate(rate: number) {
  return rate.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[11px] text-ink-muted">{label}</span>
    </div>
  )
}

function UnitList({
  material,
  base,
  visible,
}: {
  material: SourceMaterial
  base: string
  /** Units in the filtered exam's scope; null = all. */
  visible: Set<string> | null
}) {
  const { t } = useTranslation()
  const measure = measureOf(material.source)
  const units = visible ? material.units.filter((u) => visible.has(u.id)) : material.units
  const progress = asProgress(material.units)
  const depth = new Map<string, number>()
  for (const u of material.units)
    depth.set(u.id, u.parent_id ? (depth.get(u.parent_id) ?? 0) + 1 : 0)
  const parents = new Set(material.units.map((u) => u.parent_id).filter(Boolean))

  if (units.length === 0) {
    return (
      <p className="rounded-card glass p-4 text-sm text-ink-muted">
        {t('sources.detail.noneInExam')}
      </p>
    )
  }
  return (
    <div className="flex flex-col rounded-card glass p-1.5">
      {units.map((u, i) => {
        const d = depth.get(u.id) ?? 0
        // A parent shows the lowest status of its sub-units ("whole chapter read").
        const level = parents.has(u.id)
          ? Math.min(...subtreeLeaves(progress, u.id).map((l) => l.level))
          : u.level
        const meta = [
          pagesLabel(t, measure, u),
          u.ai_difficulty !== null &&
            !parents.has(u.id) &&
            t('sources.detail.difficulty', { d: u.ai_difficulty }),
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <Link
            key={u.id}
            to={`${base}/units/${u.id}`}
            style={{ paddingLeft: 10 + d * 20 }}
            className={cn(
              'flex min-h-11 items-center gap-3 py-[11px] pr-2.5',
              i < units.length - 1 && 'border-b border-canvas',
            )}
          >
            <span className="w-[30px] shrink-0 text-[13px] font-semibold text-ink-muted">
              {u.label}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className={cn('text-sm', d === 0 ? 'font-semibold' : 'font-normal')}>
                {u.title}
              </span>
              {meta && <span className="text-[11px] text-ink-subtle">{meta}</span>}
            </span>
            <span
              className={cn(
                'flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-[11px] font-semibold whitespace-nowrap',
                STATUS_CHIP[level],
              )}
            >
              {statusLabel(t, u.kind, level, u)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function Archived({ subjectId, source }: { subjectId: string; source: SourceWithUnits }) {
  const { t } = useTranslation()
  const update = useUpdateUnit(subjectId)
  const [open, setOpen] = useState(false)
  const archived = archivedUnits(source)
  if (archived.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="h-[52px] rounded-full border border-dashed border-line text-sm font-medium text-ink-muted"
      >
        {t('sources.detail.archived', { count: archived.length })}
      </button>
      {open && (
        <div className="flex flex-col rounded-card glass p-1.5">
          {archived.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-1.5 pr-1 pl-2.5">
              <span className="w-[30px] shrink-0 text-[13px] font-semibold text-ink-muted">
                {u.label}
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink-muted">{u.title}</span>
              <button
                type="button"
                onClick={() => update.mutate({ id: u.id, patch: { archived_at: null } })}
                className="h-11 shrink-0 px-3 text-[13px] font-semibold text-brand"
              >
                {t('sources.detail.restore')}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

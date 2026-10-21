import type { TFunction } from 'i18next'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { ChevronLeftIcon, MoreIcon, PlusIcon } from '@/components/icons'
import { LazyMarkdown } from '@/components/LazyMarkdown'
import { SplashScreen } from '@/components/SplashScreen'
import { Button } from '@/components/ui/button'
import { useSubject } from '@/features/subjects/api'
import type { SubjectWithAssessments } from '@/features/subjects/model'
import { subtreeLeaves } from '@/lib/progress'
import { scopeOf } from '@/lib/progress/scope'
import { cn } from '@/lib/utils'
import { useScope, useSource, useSources, useTopics, useUpdateUnit, type UnitPatch } from './api'
import { CardsSection } from './CardsSection'
import { formatDuration, pagesLabel, STATUS_CHIP, statusLabel } from './format'
import {
  asProgress,
  levelsFor,
  materialOf,
  measureOf,
  relatedUnits,
  toScopeRows,
  topicsOfUnit,
  type SourceMaterial,
  type SourceWithUnits,
  type Unit,
} from './model'
import { NOTES_MAX_LENGTH } from './schemas'
import { TopicsSheet } from './TopicsSheet'
import { UnitSheet } from './UnitSheet'
import { goBack } from '@/app/navigation'

/** Jedinica: status, difficulty, estimate, topics, related units, notes / answer and cards. */
export function UnitPage() {
  const { id, sourceId, unitId } = useParams()
  const { data: subject, isPending } = useSubject(id)
  const { data: source, isPending: sourcePending } = useSource(id, sourceId)
  if (isPending || sourcePending) return <SplashScreen />
  if (!subject) return <Navigate to="/subjects" replace />
  const unit = source?.units.find((u) => u.id === unitId)
  if (!source || !unit) return <Navigate to={`/subjects/${subject.id}`} replace />
  return <UnitDetail key={unit.id} subject={subject} source={source} unit={unit} />
}

function UnitDetail({
  subject,
  source,
  unit,
}: {
  subject: SubjectWithAssessments
  source: SourceWithUnits
  unit: Unit
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const update = useUpdateUnit(subject.id)
  const patch = (p: UnitPatch) => update.mutate({ id: unit.id, patch: p })
  const material = materialOf(source)
  const measure = measureOf(source)
  const estimate = material.units.find((u) => u.id === unit.id)
  const children = material.units.filter((u) => u.parent_id === unit.id)
  const isQuestion = unit.kind === 'question'
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [difficultyOpen, setDifficultyOpen] = useState(false)

  const { data: scope = [] } = useScope(subject.id)
  const { data: allSources = [] } = useSources(subject.id)
  const allUnits = allSources.flatMap((s) => s.units)
  const exams = [...subject.assessments]
    .sort((a, b) => a.at.localeCompare(b.at))
    .filter((e) =>
      scopeOf(
        { id: e.id, scopeAll: e.scope_all },
        allUnits.map((u) => ({ id: u.id, parentId: u.parent_id })),
        toScopeRows(scope),
      ).has(unit.id),
    )
    .filter((e) => !e.scope_all)

  const subtitle = [source.title, pagesLabel(t, measure, unit), ...exams.map((e) => e.title)]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goBack(navigate, `/subjects/${subject.id}/sources/${source.id}`)}
          aria-label={t('app.back')}
          className="flex size-11 items-center justify-center rounded-full glass"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <span className="text-[13px] text-ink-muted">{positionLabel(t, material, unit)}</span>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t('units.detail.more')}
          className="flex size-11 items-center justify-center rounded-full glass"
        >
          <MoreIcon />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-brand-muted">{subtitle}</span>
        <h1 className="text-[28px] leading-[1.1] font-bold">{unit.title}</h1>
        {unit.archived_at && (
          <span className="mt-1 self-start rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-ink">
            {t('units.detail.archivedBadge')}
          </span>
        )}
      </div>

      {children.length > 0 ? (
        <SubUnits material={material} unit={unit} subjectId={subject.id} />
      ) : (
        <div className="flex flex-col gap-3 rounded-card glass p-4">
          <span className="text-sm font-semibold">{t('units.detail.status')}</span>
          <div role="radiogroup" aria-label={t('units.detail.status')} className="flex gap-1.5">
            {levelsFor(unit.kind).map((level) => {
              const current = level === unit.level
              const done = level <= unit.level
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={current}
                  onClick={() => patch({ level })}
                  className={cn(
                    'flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[16px] px-0.5 text-xs font-semibold',
                    current ? 'bg-brand text-white' : done ? 'bg-brand-soft' : 'bg-canvas-soft',
                  )}
                >
                  <span
                    className={cn(
                      'h-1 w-[18px] rounded-full',
                      current ? 'bg-white' : done ? 'bg-brand-accent' : 'bg-line',
                    )}
                  />
                  {statusLabel(t, unit.kind, level)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDifficultyOpen(true)}
          className="flex flex-col gap-1.5 rounded-[22px] glass p-3.5 text-left"
        >
          <span className="text-xs text-ink-muted">{t('units.detail.difficulty')}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[22px] font-bold">
              {unit.user_difficulty ?? unit.ai_difficulty ?? '–'}
            </span>
            <span className="text-xs text-ink-muted">
              {unit.user_difficulty !== null
                ? t('units.detail.yours', { prior: unit.ai_difficulty ?? '–' })
                : t('units.detail.prior')}
            </span>
          </span>
          <span className="flex gap-[3px]">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  n <= (unit.user_difficulty ?? unit.ai_difficulty ?? 0)
                    ? 'bg-subject-pink'
                    : 'bg-hairline',
                )}
              />
            ))}
          </span>
        </button>
        <div className="flex flex-col gap-1.5 rounded-[22px] glass p-3.5">
          <span className="text-xs text-ink-muted">{t('units.detail.estimate')}</span>
          <span className="text-[22px] font-bold">
            {formatDuration(
              t,
              children.length > 0
                ? subtreeLeaves(asProgress(material.units), unit.id).reduce(
                    (s, l) => s + l.minutes,
                    0,
                  )
                : (estimate?.minutes ?? 0),
            )}
          </span>
          <span className="text-xs text-ink-muted">{t('units.detail.estimateHint')}</span>
        </div>
      </div>

      <Topics subjectId={subject.id} unit={unit} />
      <Related subjectId={subject.id} unit={unit} units={allUnits} sources={allSources} />

      {isQuestion && (
        <TextSection
          title={t('units.detail.answer')}
          empty={t('units.detail.noAnswer')}
          value={unit.answer}
          onSave={(answer) => patch({ answer: answer || null, answer_origin: 'user' })}
        />
      )}
      <TextSection
        title={t('units.detail.notes')}
        empty={t('units.detail.noNotes')}
        value={unit.notes}
        onSave={(notes) => patch({ notes: notes || null })}
      />
      <CardsSection unitId={unit.id} />

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title={unit.title}>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="pill-sm"
            variant="surface"
            className="bg-canvas"
            onClick={() => {
              setMenuOpen(false)
              setEditOpen(true)
            }}
          >
            {t('units.detail.edit')}
          </Button>
          <Button
            type="button"
            size="pill-sm"
            variant="surface"
            className="bg-canvas text-danger"
            onClick={() => {
              setMenuOpen(false)
              patch({ archived_at: unit.archived_at ? null : new Date().toISOString() })
            }}
          >
            {t(unit.archived_at ? 'units.detail.restore' : 'units.detail.archive')}
          </Button>
          {!unit.archived_at && (
            <span className="px-2 text-xs leading-[1.4] text-ink-muted">
              {t('units.detail.archiveHint')}
            </span>
          )}
        </div>
      </BottomSheet>

      <UnitSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        measure={measure}
        isNew={false}
        initial={{
          label: unit.label ?? '',
          title: unit.title,
          pageStart: unit.page_start,
          pageEnd: unit.page_end,
        }}
        takenLabels={
          new Set(
            source.units.filter((u) => u.id !== unit.id && u.label !== null).map((u) => u.label!),
          )
        }
        onSubmit={(v) =>
          patch({
            label: v.label,
            title: v.title,
            page_start: v.pageStart,
            page_end: v.pageEnd,
            ...(v.pageStart !== null && v.pageEnd !== null
              ? { amount: v.pageEnd - v.pageStart + 1 }
              : {}),
          })
        }
      />

      <BottomSheet
        open={difficultyOpen}
        onOpenChange={setDifficultyOpen}
        title={t('units.detail.rateTitle')}
        subtitle={t('units.detail.rateBody')}
      >
        <div role="radiogroup" className="flex gap-2">
          {[1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={unit.user_difficulty === d}
              onClick={() => {
                patch({ user_difficulty: unit.user_difficulty === d ? null : d })
                setDifficultyOpen(false)
              }}
              className={cn(
                'h-14 flex-1 rounded-[16px] text-lg font-bold',
                unit.user_difficulty === d ? 'bg-ink text-white' : 'bg-white/50',
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex justify-between px-1 text-xs text-ink-muted">
          <span>{t('units.detail.easy')}</span>
          <span>{t('units.detail.hard')}</span>
        </div>
      </BottomSheet>
    </div>
  )
}

function positionLabel(t: TFunction, material: SourceMaterial, unit: Unit) {
  const top = material.units.filter((u) => u.parent_id === null)
  const kind = unit.kind === 'question' ? 'question' : 'chapter'
  if (unit.parent_id !== null) {
    const parent = material.units.find((u) => u.id === unit.parent_id)
    return t('units.detail.partOf', { label: parent?.label ?? '' })
  }
  const n = top.findIndex((u) => u.id === unit.id) + 1
  return n > 0 ? t(`units.detail.position.${kind}`, { n, total: top.length }) : ''
}

function SubUnits({
  material,
  unit,
  subjectId,
}: {
  material: SourceMaterial
  unit: Unit
  subjectId: string
}) {
  const { t } = useTranslation()
  const children = material.units.filter((u) => u.parent_id === unit.id)
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{t('units.detail.subUnits')}</span>
      <div className="flex flex-col rounded-[20px] glass px-3.5 py-1">
        {children.map((c, i) => (
          <Link
            key={c.id}
            to={`/subjects/${subjectId}/sources/${material.source.id}/units/${c.id}`}
            className={cn(
              'flex min-h-11 items-center gap-2.5 py-2.5',
              i < children.length - 1 && 'border-b border-canvas',
            )}
          >
            <span className="w-8 shrink-0 text-[13px] font-semibold text-ink-muted">{c.label}</span>
            <span className="min-w-0 flex-1 text-sm">{c.title}</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap',
                STATUS_CHIP[c.level],
              )}
            >
              {statusLabel(t, c.kind, c.level)}
            </span>
          </Link>
        ))}
      </div>
      <span className="text-xs text-ink-muted">{t('units.detail.subUnitsHint')}</span>
    </div>
  )
}

function Topics({ subjectId, unit }: { subjectId: string; unit: Unit }) {
  const { t } = useTranslation()
  const { data: topics = [] } = useTopics(subjectId)
  const [open, setOpen] = useState(false)
  const mine = topicsOfUnit(unit.id, topics)
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{t('units.detail.topics')}</span>
      <div className="flex flex-wrap gap-2">
        {mine.map((topic) => (
          <span
            key={topic.id}
            className="flex h-8 items-center rounded-full glass px-3 text-[13px]"
          >
            {topic.name}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-8 items-center gap-1 rounded-full border border-dashed border-line px-3 text-[13px] font-semibold text-brand"
        >
          <PlusIcon size={14} />
          {t(mine.length ? 'units.detail.editTopics' : 'units.detail.addTopic')}
        </button>
      </div>
      <TopicsSheet
        open={open}
        onOpenChange={setOpen}
        subjectId={subjectId}
        unitId={unit.id}
        topics={topics}
      />
    </div>
  )
}

const QUESTION_CHIP: Record<number, string> = {
  0: 'bg-canvas text-ink-muted',
  1: 'bg-warning-soft text-warning-ink',
  2: 'bg-warning-soft text-warning-ink',
  3: 'bg-success-soft text-success',
}

function Related({
  subjectId,
  unit,
  units,
  sources,
}: {
  subjectId: string
  unit: Unit
  units: Unit[]
  sources: SourceWithUnits[]
}) {
  const { t } = useTranslation()
  const { data: topics = [] } = useTopics(subjectId)
  const related = relatedUnits(unit, topics, units)
  if (related.length === 0) return null
  const questions = unit.kind !== 'question'
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">
        {t(questions ? 'units.detail.relatedQuestions' : 'units.detail.relatedChapters')}{' '}
        <span className="font-normal text-ink-muted">· {related.length}</span>
      </span>
      <div className="flex flex-col rounded-[20px] glass px-3.5 py-1">
        {related.map((r, i) => {
          const source = sources.find((s) => s.id === r.source_id)
          return (
            <Link
              key={r.id}
              to={`/subjects/${subjectId}/sources/${r.source_id}/units/${r.id}`}
              className={cn(
                'flex min-h-11 items-center justify-between gap-2 py-2.5',
                i < related.length - 1 && 'border-b border-canvas',
              )}
            >
              <span className="min-w-0 text-sm">
                {r.label ? `${r.label} · ` : ''}
                {r.title}
                {!questions && source && <span className="text-ink-muted"> · {source.title}</span>}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-[10px] px-2 py-1 text-[11px] font-semibold',
                  questions ? QUESTION_CHIP[r.level] : STATUS_CHIP[r.level],
                )}
              >
                {statusLabel(t, r.kind, r.level).toLowerCase()}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** Markdown text with an inline editor ("Bilješke", "Odgovor"). */
function TextSection({
  title,
  empty,
  value,
  onSave,
}: {
  title: string
  empty: string
  value: string | null
  onSave: (value: string) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        {draft === null && (
          <button
            type="button"
            onClick={() => setDraft(value ?? '')}
            className="flex h-9 items-center rounded-full glass px-3 text-[13px] font-semibold text-brand"
          >
            {t('units.detail.editText')}
          </button>
        )}
      </div>
      {draft === null ? (
        <button
          type="button"
          onClick={() => setDraft(value ?? '')}
          className="rounded-[20px] glass p-4 text-left"
        >
          {value ? (
            <LazyMarkdown>{value}</LazyMarkdown>
          ) : (
            <span className="text-sm text-ink-muted">{empty}</span>
          )}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-[20px] glass p-3">
          <textarea
            autoFocus
            rows={8}
            value={draft}
            maxLength={NOTES_MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={title}
            className="resize-y rounded-input border-2 border-transparent bg-canvas-soft p-3 text-[15px] leading-normal outline-none focus-visible:border-brand-accent"
          />
          <span className="px-1 text-xs text-ink-muted">{t('units.detail.markdownHint')}</span>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="pill-sm" onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="pill-sm"
              className="btn-primary"
              onClick={() => {
                onSave(draft.trim())
                setDraft(null)
              }}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

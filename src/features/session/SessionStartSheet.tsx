import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { TimerIcon } from '@/components/icons'
import { OfflineNotice } from '@/components/OfflineNotice'
import { useOnline } from '@/features/owl/api'
import { useSources } from '@/features/sources/api'
import { formatDuration, pagesLabel, statusLabel } from '@/features/sources/format'
import { useSubjects } from '@/features/subjects/api'
import { defaultMode } from '@/lib/estimates/calibration'
import { cn } from '@/lib/utils'
import { useSessionWriter } from './api'
import { Chip } from './Chip'
import { PresetChips } from './PresetChips'
import { usePresets } from './presets'
import { nextLeaves, sessionSources, unitTitle } from './material'
import { useSessionUi } from './store'
import { UnitOption } from './UnitOption'

const NEXT_COUNT = 4

/**
 * "Šta učiš sad?" (PokreniSesiju), opened by the timer button when no session runs. The
 * recommended block comes with the day plan (Stage 8); until then its slot stays empty and a
 * free session picks the subject, optionally a source and a unit.
 */
export function SessionStartSheet() {
  const { t } = useTranslation()
  const open = useSessionUi((s) => s.startOpen)
  const close = useSessionUi((s) => s.closeStart)

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={t('session.start.title')}
      subtitle={t('session.start.subtitle')}
      leading={
        <span
          aria-hidden="true"
          className="icon-tile flex size-14 shrink-0 items-center justify-center rounded-[18px]"
        >
          <TimerIcon size={28} />
        </span>
      }
    >
      {open && <StartForm />}
    </BottomSheet>
  )
}

function StartForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const online = useOnline()
  const close = useSessionUi((s) => s.closeStart)
  const setTimerMode = useSessionUi((s) => s.setTimerMode)
  const { suggestedId } = usePresets()
  const [presetId, setPresetId] = useState<string | null>(null)
  const timerMode = presetId ?? suggestedId
  const writer = useSessionWriter()
  const { data: subjects, isPending } = useSubjects()
  const active = (subjects ?? []).filter((s) => !s.archived)

  const [subjectId, setSubjectId] = useState<string | null>(null)
  const subject = active.find((s) => s.id === subjectId) ?? (active.length === 1 ? active[0] : null)
  const { data: sources } = useSources(subject?.id)
  const material = sessionSources(sources ?? [])
  const [sourceId, setSourceId] = useState<string | null>(null)
  const source = material.find((s) => s.source.id === sourceId) ?? material[0] ?? null
  const [unitId, setUnitId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)

  // Nothing until subjects load, so "Prvo dodaj predmet" never flashes.
  if (isPending) return online ? null : <OfflineNotice />

  const units = source ? (showAll ? source.leaves : nextLeaves(source, NEXT_COUNT)) : []
  const unit = source?.leaves.find((u) => u.id === unitId) ?? null

  const start = async () => {
    if (!subject || busy) return
    setBusy(true)
    const isQuestions = source?.source.kind === 'questions'
    await writer.start({
      subjectId: subject.id,
      unitId: unit?.id ?? null,
      mode: unit
        ? defaultMode(unit.level, unit.kind === 'question')
        : isQuestions
          ? 'questions'
          : null,
      timerMode,
    })
    setTimerMode(timerMode)
    close()
    navigate('/session')
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div role="radiogroup" aria-label={t('session.start.title')} className="flex flex-col gap-2">
        <OptionCard
          title={t('session.start.recommendedEmpty')}
          sub={t('session.start.recommendedSoon')}
          tag={t('session.start.tagRecommended')}
          tagClass="bg-brand-soft text-avatar-ink"
          disabled
        />
        <OptionCard
          title={t('session.start.free')}
          sub={t('session.start.freeSub')}
          tag={t('session.start.tagFree')}
          tagClass="bg-warning-soft text-warning-ink"
          checked
        />
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col gap-2 text-sm text-ink-muted">
          {t('session.start.noSubjects')}
          <Link
            to="/subjects/new"
            onClick={close}
            className="font-semibold text-brand underline-offset-2 hover:underline"
          >
            {t('session.start.addSubject')}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" aria-label={t('session.start.subject')}>
            {active.map((s) => (
              <Chip
                key={s.id}
                selected={s.id === subject?.id}
                onClick={() => {
                  setSubjectId(s.id)
                  setSourceId(null)
                  setUnitId(null)
                  setShowAll(false)
                }}
              >
                {s.name}
              </Chip>
            ))}
          </div>

          {subject && material.length > 1 && (
            <div className="flex flex-wrap gap-1.5" aria-label={t('session.start.source')}>
              {material.map((m) => (
                <Chip
                  key={m.source.id}
                  tone="brand"
                  selected={m.source.id === source?.source.id}
                  onClick={() => {
                    setSourceId(m.source.id)
                    setUnitId(null)
                    setShowAll(false)
                  }}
                >
                  {m.source.title}
                </Chip>
              ))}
            </div>
          )}

          {source && (
            <div
              role="radiogroup"
              aria-label={t('session.start.unit')}
              className="flex flex-col gap-0.5 rounded-[24px] bg-canvas p-1.5"
            >
              {units.map((u) => (
                <UnitOption
                  key={u.id}
                  checked={u.id === unit?.id}
                  title={unitTitle(u)}
                  meta={[
                    pagesLabel(t, source.measure, u),
                    statusLabel(t, u.kind, u.level),
                    source.measured ? formatDuration(t, u.minutes) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onSelect={() => setUnitId(u.id === unit?.id ? null : u.id)}
                />
              ))}
              {!showAll && source.leaves.length > units.length && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="h-11 rounded-[18px] text-sm font-semibold text-brand"
                >
                  {t('session.start.allUnits', { count: source.leaves.length })}
                </button>
              )}
            </div>
          )}
          <span className="text-xs leading-[1.45] text-ink-muted">
            {t('session.start.freeHint')}
          </span>
          <h3 className="pt-1 text-[13px] font-semibold tracking-[0.3px] text-ink-secondary uppercase">
            {t('session.start.breaks')}
          </h3>
          <PresetChips label={t('session.start.breaks')} value={timerMode} onChange={setPresetId} />
          <span className="-mt-1 text-xs leading-[1.45] text-ink-muted">
            {t('session.start.breaksHint')}
          </span>
        </>
      )}

      <button
        type="button"
        onClick={start}
        disabled={!subject || busy}
        className="flex h-14 items-center justify-center gap-2 rounded-full btn-primary text-base font-semibold disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 5v14l12-7z" />
        </svg>
        {t('session.start.go')}
      </button>
    </div>
  )
}

function OptionCard({
  title,
  sub,
  tag,
  tagClass,
  checked = false,
  disabled = false,
}: {
  title: string
  sub: string
  tag: string
  tagClass: string
  checked?: boolean
  disabled?: boolean
}) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      className={cn(
        'flex items-center gap-3 rounded-[20px] border-2 p-3.5',
        checked ? 'border-brand-accent bg-canvas-soft' : 'border-hairline glass',
        disabled && 'opacity-60',
      )}
    >
      <span
        className={cn(
          'flex size-[22px] shrink-0 items-center justify-center rounded-full border-2',
          checked ? 'border-brand' : 'border-radio-ring',
        )}
      >
        <span className={cn('size-2.5 rounded-full', checked && 'bg-brand')} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-xs text-ink-muted">{sub}</span>
      </span>
      <span className={cn('rounded-lg px-2 py-1 text-[11px] font-semibold', tagClass)}>{tag}</span>
    </div>
  )
}

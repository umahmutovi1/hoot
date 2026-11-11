import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/BottomSheet'
import { OfflineNotice } from '@/components/OfflineNotice'
import { useOnline } from '@/features/owl/api'
import { useSources } from '@/features/sources/api'
import { formatDuration, pagesLabel, statusLabel } from '@/features/sources/format'
import { useSubjects } from '@/features/subjects/api'
import { defaultMode } from '@/lib/estimates/calibration'
import { cn } from '@/lib/utils'
import { useSessionWriter } from './api'
import { Chip } from './Chip'
import { RhythmRow } from './RhythmRow'
import { usePresets } from './presets'
import { nextLeaves, sessionSources, unitTitle } from './material'
import { useSessionUi } from './store'
import { UnitOption } from './UnitOption'
import { ONLY_MINUTES, picksFor, pickTitle, pickWhy, useStartPick } from '@/features/today/pick'
import { useLocale } from '@/features/settings/useLocale'
import { paletteOf } from '@/features/subjects/colors'
import { dateFnsLocales } from '@/lib/locale'
import { usePlanToday } from '@/features/today/usePlanToday'

/** "+ Predmet" / "+ Izvor" next to the chips: leaves the sheet for the form. */
const addChip =
  'flex h-11 items-center rounded-full border border-dashed border-line px-4 text-[13px] font-semibold text-brand'
const NEXT_COUNT = 4
const label = 'px-1 text-sm font-bold'

/**
 * Slobodna sesija (PokreniSesiju, PRD "Dopune, 5. nov 2026"): how long, then "Hoot predloži" (the
 * default: `pickForTime()` with "Druga ideja") or "Biram sam" (subject, optionally a source and a
 * unit), and the pauses in one row. Planned blocks start from Sljedeće and the block sheet.
 */
export function SessionStartSheet() {
  const { t } = useTranslation()
  const open = useSessionUi((s) => s.startOpen)
  const close = useSessionUi((s) => s.closeStart)

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={t('session.start.free')}
      subtitle={t('session.start.freeLead')}
    >
      {open && <StartForm />}
    </BottomSheet>
  )
}

function StartForm() {
  const { t } = useTranslation()
  const { locale } = useLocale()
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
  const plan = usePlanToday()
  const startPick = useStartPick(plan)
  const [minutes, setMinutes] = useState(30)
  const picks = picksFor(
    plan,
    minutes,
    active.map((s) => s.id),
  )
  const [chooser, setChooser] = useState<'auto' | 'manual' | null>(null)
  // Without anything to suggest (no plan yet) the choice is the user's.
  const mode = chooser ?? (picks.length > 0 ? 'auto' : 'manual')
  const [ideaIndex, setIdeaIndex] = useState(0)
  const pick = picks.length > 0 ? picks[ideaIndex % picks.length]! : null

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
  const pickSubject = active.find((s) => s.id === pick?.subjectId)
  const canStart = mode === 'auto' ? pick !== null : subject !== null

  const start = async () => {
    if (busy || !canStart) return
    setBusy(true)
    if (mode === 'auto' && pick) {
      await startPick(pick, timerMode)
      close()
      return
    }
    const isQuestions = source?.source.kind === 'questions'
    await writer.start({
      subjectId: subject!.id,
      unitId: unit?.id ?? null,
      mode: unit
        ? defaultMode(unit.level, unit.kind === 'question')
        : isQuestions
          ? 'questions'
          : null,
      timerMode,
      plannedMinutes: minutes,
    })
    setTimerMode(timerMode)
    close()
    navigate('/session')
  }

  if (active.length === 0)
    return (
      <div className="flex flex-col gap-2 text-sm text-ink-muted">
        {t('session.start.noSubjects')}
        <Link to="/subjects/new" onClick={close} className="font-semibold text-brand">
          {t('session.start.addSubject')}
        </Link>
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className={label}>{t('session.start.howLong')}</span>
        <div
          role="radiogroup"
          aria-label={t('session.start.howLong')}
          className="grid grid-cols-4 gap-2"
        >
          {ONLY_MINUTES.map((m) => (
            <Chip
              key={m}
              selected={m === minutes}
              onClick={() => {
                setMinutes(m)
                setIdeaIndex(0)
              }}
              className="justify-center tabular-nums"
            >
              {formatDuration(t, m)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>{t('session.start.what')}</span>
        {picks.length > 0 && (
          <div
            role="radiogroup"
            aria-label={t('session.start.what')}
            className="grid grid-cols-2 gap-1 rounded-full bg-canvas p-1"
          >
            {(['auto', 'manual'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setChooser(m)}
                className={cn(
                  'h-10 rounded-full text-sm font-bold',
                  mode === m ? 'bg-raised text-ink shadow-sm' : 'text-ink-secondary',
                )}
              >
                {t(`session.start.${m}`)}
              </button>
            ))}
          </div>
        )}

        {mode === 'auto' && pick ? (
          <>
            <div
              className={cn(
                'flex flex-col gap-1 rounded-[22px] px-4 py-3.5',
                paletteOf(pickSubject?.color ?? null).soft,
                paletteOf(pickSubject?.color ?? null).inkText,
              )}
            >
              <span className="text-[17px] font-bold">
                {pickTitle(t, pick, plan.units, pickSubject?.name ?? '')}
              </span>
              <span className="text-sm">
                {t('session.start.why', {
                  why: pickWhy(t, plan, pick, dateFnsLocales[locale]),
                })}
              </span>
            </div>
            {picks.length > 1 && (
              <button
                type="button"
                onClick={() => setIdeaIndex((i) => i + 1)}
                className="flex h-11 items-center self-start px-1 text-[15px] font-bold text-brand-strong"
              >
                {t('session.start.another', {
                  n: (ideaIndex % picks.length) + 1,
                  total: picks.length,
                })}
              </button>
            )}
          </>
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

            {subject && (
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
                <Link
                  to={`/subjects/${subject.id}/sources/new`}
                  onClick={close}
                  className={addChip}
                >
                  {material.length === 0
                    ? t('session.start.addFirstSource')
                    : t('session.start.newSource')}
                </Link>
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
                      statusLabel(t, u.kind, u.level, u),
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
            <span className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
              {t('session.start.manualHint')}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>{t('session.start.breaks')}</span>
        <RhythmRow value={timerMode} onChange={setPresetId} />
      </div>

      <button
        type="button"
        onClick={() => void start()}
        disabled={!canStart || busy}
        className="btn-primary flex h-14 items-center justify-center gap-2 rounded-[18px] text-[17px] font-bold"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 5v14l12-7z" />
        </svg>
        {t('today.only.start', { minutes: mode === 'auto' && pick ? pick.minutes : minutes })}
      </button>
    </div>
  )
}

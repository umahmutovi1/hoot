import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { OfflineNotice } from '@/components/OfflineNotice'
import { ScreenTitle } from '@/components/ScreenTitle'
import { useOnline } from '@/features/owl/api'
import { useSources } from '@/features/sources/api'
import { formatDuration, pagesLabel, statusLabel } from '@/features/sources/format'
import { useSubjects } from '@/features/subjects/api'
import { defaultMode } from '@/lib/estimates/calibration'
import { cn } from '@/lib/utils'
import { useSessionWriter } from './api'
import { Chip } from './Chip'
import { RhythmRow } from './RhythmRow'
import { Stepper } from './Stepper'
import { useKeepRhythm, usePresets } from './presets'
import { nextLeaves, sessionSources, unitTitle } from './material'
import { useSessionUi } from './store'
import { UnitOption } from './UnitOption'
import { ONLY_MINUTES, picksFor, pickTitle, pickWhy, useStartPick } from '@/features/today/pick'
import { useLocale } from '@/features/settings/useLocale'
import { paletteOf } from '@/features/subjects/colors'
import { dateFnsLocales } from '@/lib/locale'
import { usePlanToday } from '@/features/today/usePlanToday'

/** "+ Predmet" / "+ Izvor" next to the chips: leaves the screen for the form. */
const addChip =
  'flex h-11 items-center rounded-full border border-dashed border-line px-4 text-[13px] font-semibold text-brand'
const NEXT_COUNT = 4
const label = 'px-1 text-[15px] font-bold'
/** "Drugo": 10 to 180 min, in steps of 5 up to an hour and of 15 above it. */
const CUSTOM = { min: 10, max: 180 }
const stepDown = (m: number) => (m > 60 ? 15 : 5)
const stepUp = (m: number) => (m >= 60 ? 15 : 5)

/**
 * Slobodna sesija (board PokreniSesiju, PRD "Dopune, 5. nov 2026"): how long, then "Hoot predloži"
 * (the default: `pickForTime()` with "Druga ideja") or "Biram sam" (subject, optionally a source
 * and a unit), and the pauses in one row. Planned blocks start from Sljedeće and the block sheet.
 */
export function FreeSessionPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const online = useOnline()
  const setTimerMode = useSessionUi((s) => s.setTimerMode)
  const { suggestedId } = usePresets()
  const keepRhythm = useKeepRhythm()
  const [presetId, setPresetId] = useState<string | null>(null)
  const [keep, setKeep] = useState(false)
  const timerMode = presetId ?? suggestedId
  const writer = useSessionWriter()
  const { data: subjects, isPending } = useSubjects()
  const active = (subjects ?? []).filter((s) => !s.archived)
  const plan = usePlanToday()
  const startPick = useStartPick(plan)
  const [preset, setPreset] = useState<number | 'custom'>(30)
  const [customMinutes, setCustomMinutes] = useState(40)
  const minutes = preset === 'custom' ? customMinutes : preset
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

  const title = <ScreenTitle title={t('session.start.free')} sub={t('session.start.freeLead')} />
  // Nothing until subjects load, so "Prvo dodaj predmet" never flashes.
  if (isPending) return online ? title : [title, <OfflineNotice key="offline" />]

  const units = source ? (showAll ? source.leaves : nextLeaves(source, NEXT_COUNT)) : []
  const unit = source?.leaves.find((u) => u.id === unitId) ?? null
  const pickSubject = active.find((s) => s.id === pick?.subjectId)
  const canStart = mode === 'auto' ? pick !== null : subject !== null
  const pickMinutes = (m: number | 'custom') => {
    setPreset(m)
    setIdeaIndex(0)
  }

  const start = async () => {
    if (busy || !canStart) return
    setBusy(true)
    try {
      const rhythm = keep ? await keepRhythm(timerMode) : timerMode
      if (mode === 'auto' && pick) {
        await startPick(pick, rhythm)
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
        timerMode: rhythm,
        plannedMinutes: minutes,
      })
      setTimerMode(rhythm)
      navigate('/session')
    } finally {
      setBusy(false)
    }
  }

  if (active.length === 0)
    return (
      <>
        {title}
        <div className="mt-2 flex flex-col gap-2 text-sm text-ink-muted">
          {t('session.start.noSubjects')}
          <Link to="/subjects/new" className="font-semibold text-brand">
            {t('session.start.addSubject')}
          </Link>
        </div>
      </>
    )

  const durationButton = (on: boolean) =>
    cn(
      'h-14 rounded-[16px] font-bold tabular-nums transition-colors',
      on ? 'bg-brand text-ground' : 'surface text-ink',
    )

  return (
    <>
      {title}
      <div className="mt-2 flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <span className={label}>{t('session.start.howLong')}</span>
          <div
            role="radiogroup"
            aria-label={t('session.start.duration')}
            className="grid grid-cols-5 gap-2"
          >
            {ONLY_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={preset === m}
                aria-label={formatDuration(t, m)}
                onClick={() => pickMinutes(m)}
                className={cn(durationButton(preset === m), 'font-display text-xl')}
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={preset === 'custom'}
              onClick={() => pickMinutes('custom')}
              className={cn(durationButton(preset === 'custom'), 'text-sm')}
            >
              {t('session.start.other')}
            </button>
          </div>
          {preset === 'custom' && (
            <div className="animate-settle-in">
              <Stepper
                label={t('session.start.duration')}
                value={t('session.rhythm.minutes', { count: customMinutes })}
                less={t('session.start.durationLess', { count: stepDown(customMinutes) })}
                more={t('session.start.durationMore', { count: stepUp(customMinutes) })}
                onLess={() => {
                  setCustomMinutes((m) => Math.max(CUSTOM.min, m - stepDown(m)))
                  setIdeaIndex(0)
                }}
                onMore={() => {
                  setCustomMinutes((m) => Math.min(CUSTOM.max, m + stepUp(m)))
                  setIdeaIndex(0)
                }}
                min={customMinutes <= CUSTOM.min}
                max={customMinutes >= CUSTOM.max}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className={label}>{t('session.start.what')}</span>
          {picks.length > 0 && (
            <div
              role="radiogroup"
              aria-label={t('session.start.who')}
              className="grid h-12 grid-cols-2 gap-1 rounded-full surface p-1"
            >
              {(['auto', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setChooser(m)}
                  className={cn(
                    'h-10 rounded-full text-[15px] font-bold transition-colors',
                    mode === m ? 'bg-raised text-ink shadow-sm' : 'text-ink-secondary',
                  )}
                >
                  {t(`session.start.${m}`)}
                </button>
              ))}
            </div>
          )}

          {mode === 'auto' && pick ? (
            <div className="flex animate-settle-in flex-col gap-2">
              <div
                className={cn(
                  'flex flex-col gap-1.5 rounded-[22px] p-4',
                  paletteOf(pickSubject?.color ?? null).soft,
                  paletteOf(pickSubject?.color ?? null).inkText,
                )}
              >
                <span className="flex items-center gap-2 text-[13px] font-bold">
                  <span
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      paletteOf(pickSubject?.color ?? null).bar,
                    )}
                  />
                  {pickSubject?.name}
                </span>
                <span className="font-display text-2xl leading-[1.1] font-bold text-ink">
                  {pickTitle(t, pick, plan.units, '')}
                </span>
                <span className="text-sm tabular-nums">{formatDuration(t, pick.minutes)}</span>
                <span className="text-[13px] opacity-85">
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
            </div>
          ) : (
            <div className="flex animate-settle-in flex-col gap-2.5">
              <div
                role="radiogroup"
                aria-label={t('session.start.subject')}
                className="flex flex-wrap gap-2"
              >
                {active.map((s) => {
                  const on = s.id === subject?.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setSubjectId(s.id)
                        setSourceId(null)
                        setUnitId(null)
                        setShowAll(false)
                      }}
                      className={cn(
                        'flex h-11 items-center gap-2 rounded-[14px] pr-3.5 pl-3 text-sm font-bold',
                        on ? 'bg-raised shadow-[inset_0_0_0_2px_var(--color-brand)]' : 'surface',
                      )}
                    >
                      <span
                        className={cn('size-2.5 shrink-0 rounded-full', paletteOf(s.color).bar)}
                      />
                      {s.name}
                    </button>
                  )
                })}
              </div>

              {subject && (
                <div className="flex flex-wrap gap-1.5" aria-label={t('session.start.source')}>
                  {material.length > 1 &&
                    material.map((m) => (
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
                  {material.length === 0 && (
                    <Link to={`/subjects/${subject.id}/sources/new`} className={addChip}>
                      {t('session.start.addFirstSource')}
                    </Link>
                  )}
                </div>
              )}

              {source && (
                <div
                  role="radiogroup"
                  aria-label={t('session.start.unit')}
                  className="flex flex-col gap-1.5"
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
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className={label}>{t('session.start.breaks')}</span>
          <RhythmRow value={timerMode} onChange={setPresetId} keep={keep} onKeepChange={setKeep} />
        </div>
      </div>

      <div className="sticky bottom-[calc(16px+var(--nav-offset,0px)+env(safe-area-inset-bottom))] z-10 -mx-5 mt-6 bg-ground px-5 pt-3">
        <button
          type="button"
          onClick={() => void start()}
          disabled={!canStart || busy}
          className="btn-primary flex h-14 w-full items-center justify-center gap-2.5 rounded-[18px] text-[17px] font-bold"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 5v14l12-7z" />
          </svg>
          {t('today.only.start', { minutes: mode === 'auto' && pick ? pick.minutes : minutes })}
        </button>
      </div>
    </>
  )
}

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
import { useStartBlock } from '@/features/plan/actions'
import { blockSub, blockTitle, isOpen, nextBlock, useGoalTitle } from '@/features/plan/model'
import { ONLY_MINUTES, pickFor, pickTitle, useStartPick } from '@/features/today/pick'
import { usePlanToday } from '@/features/today/usePlanToday'

/** "+ Predmet" / "+ Izvor" next to the chips: leaves the sheet for the form. */
const addChip =
  'flex h-11 items-center rounded-full border border-dashed border-line px-4 text-[13px] font-semibold text-brand'
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
  const { todayBlocks } = usePlanToday()
  const planned = todayBlocks.some(isOpen)

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={t('session.start.title')}
      subtitle={planned ? t('session.start.subtitlePlan') : t('session.start.subtitle')}
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
  const plan = usePlanToday()
  const goalTitle = useGoalTitle()
  const startBlock = useStartBlock()
  const startPick = useStartPick(plan)
  const open = plan.todayBlocks.filter(isOpen)
  const next = nextBlock(plan.todayBlocks, plan.nowMin)
  const others = open.filter((b) => b.id !== next?.id)
  const [choice, setChoice] = useState<string | null>(null)
  const picked = choice ?? next?.id ?? 'free'
  const block = open.find((b) => b.id === picked) ?? null
  const [minutes, setMinutes] = useState(0)
  const pick = minutes > 0 ? pickFor(plan, minutes) : null

  const subjectShort = (id: string) =>
    (active.find((s) => s.id === id)?.name ?? '').split(' ')[0] ?? ''

  // Nothing until subjects load, so "Prvo dodaj predmet" never flashes.
  if (isPending) return online ? null : <OfflineNotice />

  const units = source ? (showAll ? source.leaves : nextLeaves(source, NEXT_COUNT)) : []
  const unit = source?.leaves.find((u) => u.id === unitId) ?? null

  const start = async () => {
    if (busy) return
    if (pick || block) {
      setBusy(true)
      if (pick) await startPick(pick, timerMode)
      else await startBlock(block!, plan.units, { timerMode })
      close()
      return
    }
    if (!subject) return
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
        {next && (
          <OptionCard
            title={`${subjectShort(next.subject_id)} — ${blockTitle(t, next, plan.units, goalTitle(next.deadline_id ?? ''))}`}
            sub={`${t('session.start.nextBlock')} · ${blockSub(t, next, plan.units)}`}
            tag={t('session.start.tagRecommended')}
            tagClass="bg-brand-soft text-avatar-ink"
            checked={picked === next.id}
            onSelect={() => setChoice(next.id)}
          />
        )}
        {others.map((b) => (
          <OptionCard
            key={b.id}
            title={`${subjectShort(b.subject_id)} — ${blockTitle(t, b, plan.units, goalTitle(b.deadline_id ?? ''))}`}
            sub={`${t('session.start.laterToday')} · ${blockSub(t, b, plan.units)}`}
            tag={t('session.start.tagPlan')}
            tagClass="bg-canvas text-ink-secondary"
            checked={picked === b.id}
            onSelect={() => setChoice(b.id)}
          />
        ))}
        <OptionCard
          title={t('session.start.free')}
          sub={t('session.start.freeSub')}
          tag={t('session.start.tagFree')}
          tagClass="bg-warning-soft text-warning-ink"
          checked={picked === 'free'}
          onSelect={() => {
            setChoice('free')
            setMinutes(0)
          }}
        />
      </div>

      {open.length > 0 && picked !== 'free' && (
        <>
          <h3 className="pt-1 text-[13px] font-semibold tracking-[0.3px] text-ink-secondary uppercase">
            {t('session.start.howLong')}
          </h3>
          <div className="flex gap-1.5">
            {[0, ...ONLY_MINUTES].map((m) => (
              <Chip
                key={m}
                selected={m === minutes}
                onClick={() => setMinutes(m)}
                className="flex-1 justify-center px-1.5 whitespace-nowrap"
              >
                {m === 0 ? t('session.start.wholeBlock') : m}
              </Chip>
            ))}
          </div>
          <h3 className="pt-1 text-[13px] font-semibold tracking-[0.3px] text-ink-secondary uppercase">
            {t('session.start.breaks')}
          </h3>
          <PresetChips label={t('session.start.breaks')} value={timerMode} onChange={setPresetId} />
          <span className="-mt-1 text-xs leading-[1.45] text-ink-muted">
            {pick
              ? t('session.start.onlyHint', {
                  minutes,
                  title: pickTitle(t, pick, plan.units, subjectShort(pick.subjectId)),
                })
              : t('session.start.breaksHint')}
          </span>
        </>
      )}

      {picked !== 'free' ? null : active.length === 0 ? (
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
            <Link to="/subjects/new" onClick={close} className={addChip}>
              {t('session.start.newSubject')}
            </Link>
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
              <Link to={`/subjects/${subject.id}/sources/new`} onClick={close} className={addChip}>
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
        disabled={(picked === 'free' && !subject) || busy}
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
  onSelect,
}: {
  title: string
  sub: string
  tag: string
  tagClass: string
  checked?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 rounded-[20px] border-2 p-3.5 text-left',
        checked ? 'border-brand-accent bg-canvas-soft' : 'border-hairline glass',
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
      <span className={cn('shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold', tagClass)}>
        {tag}
      </span>
    </button>
  )
}

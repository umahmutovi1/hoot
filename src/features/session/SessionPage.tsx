import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { goBack } from '@/app/navigation'
import { ChevronLeftIcon, PencilIcon, PlusIcon } from '@/components/icons'
import { OfflineNotice } from '@/components/OfflineNotice'
import { useOnline } from '@/features/owl/api'
import { useSources } from '@/features/sources/api'
import { pagesLabel } from '@/features/sources/format'
import { useSubject } from '@/features/subjects/api'
import {
  activeMs,
  forgottenSegment,
  breakEndsAt,
  presetReminder,
  MINUTE,
  msByUnit,
  openSegment,
  pauseStats,
  type IntervalReminder,
  type Preset,
} from '@/lib/session/timer'
import { cn } from '@/lib/utils'
import { useActiveSession, useSessionWriter } from './api'
import { Chip } from './Chip'
import { ACCIDENTAL_MS, EndEarlySheet } from './EndEarlySheet'
import { ForgottenSheet } from './ForgottenSheet'
import { findUnit, nextLeaves, sessionSources, unitTitle, type SessionSource } from './material'
import { bySegmentStart, formatClock, STUDY_MODES, toSegment } from './model'
import { presetName, usePresets } from './presets'
import { useSessionUi } from './store'
import { usePendingSync } from './usePendingSync'
import { TimerSheet } from './TimerSheet'
import { UnitOption } from './UnitOption'
import { UnitPickerSheet } from './UnitPickerSheet'
import { useNow } from './useNow'

const RING_R = 104
const RING_C = 2 * Math.PI * RING_R

/** Active session (Sesija mockup). Everything shown is computed from segment timestamps. */
export function SessionPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const online = useOnline()
  const { data, isPending } = useActiveSession()
  const writer = useSessionWriter()
  const now = useNow(1000, Boolean(data))
  const { data: subject } = useSubject(data?.session.subject_id)
  const { data: sourceRows } = useSources(data?.session.subject_id)
  const sources = sessionSources(sourceRows ?? [])
  const nextUnit = useSessionUi((s) => s.nextUnit)
  const setNextUnit = useSessionUi((s) => s.setNextUnit)
  const keptSegmentId = useSessionUi((s) => s.keptSegmentId)
  const pending = usePendingSync()
  const [timerSheet, setTimerSheet] = useState(false)
  const [picker, setPicker] = useState(false)
  const [endSheet, setEndSheet] = useState(false)
  const vibrated = useRef<string | null>(null)

  const segments = data ? [...data.segments].sort(bySegmentStart) : []
  const list = segments.map(toSegment)
  const open = openSegment(list)
  const { resolve } = usePresets()
  const preset = resolve(data?.session.timer_mode)
  const reminder = data ? presetReminder(preset, list, now) : null
  const reminderKey =
    reminder && reminder.remainingMs <= 0 ? `${reminder.phase}-${segments.at(-1)?.id}` : null

  // A short buzz when a preset's phase is over while the screen is open; nothing else happens.
  useEffect(() => {
    if (!reminderKey || vibrated.current === reminderKey) return
    vibrated.current = reminderKey
    navigator.vibrate?.(200)
  }, [reminderKey])

  if (isPending) return null
  if (!data) {
    return online ? <Navigate to="/" replace /> : <OfflineNotice />
  }

  const { session } = data
  const active = activeMs(list, now)
  const pauses = pauseStats(list, now)
  const byUnit = msByUnit(list, now)
  const lastUnitId = segments.at(-1)?.unit_id ?? null
  const pickedId =
    open?.unitId ?? (nextUnit?.sessionId === session.id ? nextUnit.unitId : lastUnitId)
  const picked = findUnit(sources, pickedId)
  const forgotten = forgottenSegment(list, now)

  const pick = (unitId: string | null) => {
    if (open) void writer.switchUnit(data, unitId)
    else setNextUnit({ sessionId: session.id, unitId })
  }
  const toggle = () => {
    if (open) {
      // `now` is at most a second old: close enough for when the break ends.
      const closed = list.map((x) => (x.id === open.id ? { ...x, endedAt: now } : x))
      void writer.pause(data, breakEndsAt(preset, closed, now))
    } else {
      void writer.resume(data, pickedId)
      setNextUnit(null)
    }
  }
  const finish = async (at?: Date) => {
    await writer.finish(data, at)
    setNextUnit(null)
    navigate(`/session/${session.id}/end`, { replace: true })
  }

  // Ending before the planned time (or right after starting) asks first.
  const endsEarly =
    active < ACCIDENTAL_MS ||
    (session.planned_minutes !== null && active < (session.planned_minutes - 1) * MINUTE)
  const progress = session.planned_minutes
    ? active / (session.planned_minutes * MINUTE)
    : reminder?.phase === 'work'
      ? 1 - reminder.remainingMs / reminder.totalMs
      : (active % (60 * MINUTE)) / (60 * MINUTE)

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-5 -mt-6 flex items-center justify-between gap-2 glass-bar px-5 pt-[calc(24px+env(safe-area-inset-top))] pb-2 ">
        <button
          type="button"
          onClick={() => goBack(navigate, '/')}
          aria-label={t('app.back')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full glass"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <div className="flex min-w-0 flex-col items-center gap-0.5">
          <h1 className="truncate text-base font-semibold">
            {subject?.name ?? t('session.title')}
          </h1>
          <span className="text-xs text-ink-muted">
            {open ? t('session.timer.running') : t('session.timer.paused')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setTimerSheet(true)}
          aria-label={t('session.timer.settings')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full glass"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
        </button>
      </div>

      <div role="group" aria-label={t('session.mode.label')} className="flex flex-wrap gap-2">
        {STUDY_MODES.map((m) => (
          <Chip
            key={m}
            tone="brand"
            selected={session.mode === m}
            onClick={() => void writer.update(data, { mode: m })}
          >
            {t(`session.mode.${m}`)}
          </Chip>
        ))}
      </div>

      <section className="flex flex-col items-center gap-[18px] rounded-[32px] glass px-5 py-6">
        <div className="relative size-[236px]">
          <svg width="236" height="236" viewBox="0 0 236 236" aria-hidden="true">
            <circle
              cx="118"
              cy="118"
              r={RING_R}
              fill="none"
              strokeWidth="14"
              className="stroke-hairline"
            />
            <circle
              cx="118"
              cy="118"
              r={RING_R}
              fill="none"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${Math.min(1, Math.max(0, progress)) * RING_C} ${RING_C}`}
              transform="rotate(-90 118 118)"
              className={open ? 'stroke-brand-accent' : 'stroke-radio-ring'}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span
              role="timer"
              aria-label={t('session.timer.studied')}
              className="text-[52px] leading-none font-semibold tracking-[-1px] tabular-nums"
            >
              {formatClock(active)}
            </span>
            <span className="text-[13px] text-ink-muted">
              {session.planned_minutes
                ? t('session.timer.ofPlanned', { min: session.planned_minutes })
                : t('session.timer.free')}
            </span>
            {reminder && <ReminderBadge reminder={reminder} preset={preset} />}
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={toggle}
            className="flex h-14 items-center gap-2 rounded-full border-2 border-brand glass px-[22px] text-base font-semibold text-brand"
          >
            {open ? t('session.timer.pause') : t('session.timer.resume')}
          </button>
          <button
            type="button"
            onClick={() => (endsEarly ? setEndSheet(true) : void finish())}
            className="flex h-14 items-center gap-2 rounded-full btn-primary px-[26px] text-base font-semibold"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            {t('session.timer.finish')}
          </button>
        </div>
        <span className="text-xs text-ink-muted">
          {t('session.timer.segments', { count: segments.length })}
          {' · '}
          {t('session.timer.pauseTotal', { count: Math.round(pauses.ms / MINUTE) })}
        </span>
        {pending > 0 && !online && (
          <span className="text-center text-xs text-ink-muted">
            {t('session.timer.savedOffline')}
          </span>
        )}
      </section>

      <div className="mt-1 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{t('session.units.title')}</h2>
        <span className="text-xs text-ink-muted">{t('session.units.hint')}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={t('session.units.title')}
        className="flex flex-col gap-0.5 rounded-[24px] glass p-1.5"
      >
        {unitRows(
          sources,
          segments.map((s) => s.unit_id),
          pickedId,
        ).map(({ source, unit }) => (
          <UnitOption
            key={unit.id}
            checked={unit.id === pickedId}
            title={unitTitle(unit)}
            meta={pagesLabel(t, source.measure, unit)}
            trailing={t('time.minutes', { m: Math.floor((byUnit.get(unit.id) ?? 0) / MINUTE) })}
            onSelect={() => pick(unit.id)}
          />
        ))}
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="flex h-11 items-center justify-center gap-1.5 rounded-[18px] text-sm font-semibold text-brand"
        >
          <PlusIcon size={16} />
          {t('session.units.other')}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          void writer.distracted(data)
          navigator.vibrate?.(30)
        }}
        className="flex h-[52px] items-center justify-center gap-2 rounded-full glass text-[15px] font-semibold"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-brand"
        >
          <rect x="7" y="3" width="10" height="18" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
        {t('session.distracted')}
        {session.distractions > 0 && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand tabular-nums">
            {session.distractions}
          </span>
        )}
      </button>

      {picked && (
        <Link
          to={`/subjects/${session.subject_id}/sources/${picked.source.source.id}/units/${picked.unit.id}`}
          className="flex h-[52px] items-center justify-center gap-2 rounded-full glass text-[15px] font-semibold"
        >
          <PencilIcon size={18} className="text-brand" />
          {t('session.units.note')}
        </Link>
      )}

      <TimerSheet open={timerSheet} onOpenChange={setTimerSheet} data={data} />
      <UnitPickerSheet
        open={picker}
        onOpenChange={setPicker}
        sources={sources}
        selected={pickedId}
        onPick={(id) => {
          pick(id)
          setPicker(false)
        }}
      />
      <EndEarlySheet
        data={data}
        activeMs={active}
        open={endSheet}
        onOpenChange={setEndSheet}
        onFinish={() => void finish()}
      />
      {forgotten && forgotten.id !== keptSegmentId && (
        <ForgottenSheet segment={forgotten} now={now} onFinish={(at) => void finish(at)} />
      )}
    </div>
  )
}

function ReminderBadge({ reminder, preset }: { reminder: IntervalReminder; preset: Preset }) {
  const { t } = useTranslation()
  // A free pause counts up and never shows as due (the interval waits where it stopped).
  const due = reminder.phase !== 'free' && reminder.remainingMs <= 0
  const label =
    reminder.phase === 'free'
      ? t('session.timer.freePause', { time: formatClock(reminder.elapsedMs ?? 0) })
      : reminder.phase === 'work'
        ? due
          ? t('session.timer.breakDue')
          : t('session.timer.breakIn', {
              mode: presetName(t, preset),
              time: formatClock(reminder.remainingMs),
            })
        : due
          ? t('session.timer.backDue')
          : t('session.timer.backIn', { time: formatClock(reminder.remainingMs) })
  return (
    <span
      className={cn(
        'mt-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        due ? 'bg-warning-soft text-warning' : 'bg-brand-soft text-brand',
      )}
    >
      {label}
    </span>
  )
}

/**
 * Units in "Sad radim na": the ones studied in this session and the next two after the furthest
 * one in its source; without any yet, the next units of the first source.
 */
function unitRows(sources: SessionSource[], studied: (string | null)[], picked: string | null) {
  const ids = [...new Set([...studied, picked].filter((id): id is string => Boolean(id)))]
  const rows: { source: SessionSource; unit: SessionSource['leaves'][number] }[] = []
  for (const source of sources) {
    const idx = ids.map((id) => source.leaves.findIndex((u) => u.id === id)).filter((i) => i >= 0)
    if (idx.length === 0) continue
    const from = Math.min(...idx)
    const to = Math.min(source.leaves.length - 1, Math.max(...idx) + 2)
    for (const unit of source.leaves.slice(from, to + 1)) rows.push({ source, unit })
  }
  if (rows.length === 0 && sources[0])
    for (const unit of nextLeaves(sources[0], 3)) rows.push({ source: sources[0], unit })
  return rows
}

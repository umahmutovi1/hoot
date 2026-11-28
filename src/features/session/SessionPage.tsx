import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { goBack } from '@/app/navigation'
import { BookIcon, ChevronLeftIcon, PencilIcon, SparkleIcon } from '@/components/icons'
import { OfflineNotice } from '@/components/OfflineNotice'
import { useOnline } from '@/features/owl/api'
import { LinkedQuestionsOffer } from '@/features/review/LinkedQuestionsOffer'
import { SessionQuizOffer } from '@/features/review/SessionQuizOffer'
import { useSubscriptions } from '@/features/notify/api'
import { useProfile } from '@/features/settings/profile'
import { useSources } from '@/features/sources/api'
import { SessionSummary } from './SessionSummary'
import { useSubject } from '@/features/subjects/api'
import {
  activeMs,
  forgottenSegment,
  breakEndsAt,
  MINUTE,
  openSegment,
  pauseStats,
  type Preset,
} from '@/lib/session/timer'
import { sessionReminder, type SessionReminder } from '@/lib/session/shape'
import { cn } from '@/lib/utils'
import { useActiveSession, useSessionWriter } from './api'
import { EndEarlySheet } from './EndEarlySheet'
import { ForgottenSheet } from './ForgottenSheet'
import { findUnit, sessionSources, unitTitle } from './material'
import { bySegmentStart, formatClock, toSegment } from './model'
import { presetName, usePresets } from './presets'
import { useSessionUi } from './store'
import { usePendingSync } from './usePendingSync'
import { TimerSheet } from './TimerSheet'
import { UnitPickerSheet } from './UnitPickerSheet'
import { useAppAway } from './useAppAway'
import { useNow } from './useNow'

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
  const check = useSessionUi((s) => s.check)
  const { data: profile } = useProfile()
  const { data: pushSubs = [] } = useSubscriptions()
  const notifyBreak = (profile?.notify_break_end ?? true) && pushSubs.length > 0
  const pending = usePendingSync()
  const [timerSheet, setTimerSheet] = useState(false)
  const [picker, setPicker] = useState(false)
  const [endSheet, setEndSheet] = useState(false)
  const [tutorAfterPick, setTutorAfterPick] = useState(false)
  const vibrated = useRef<string | null>(null)
  const segments = data ? [...data.segments].sort(bySegmentStart) : []
  const list = segments.map(toSegment)
  const open = openSegment(list)
  const { resolve } = usePresets()
  const preset = resolve(data?.session.timer_mode)
  const reminder = data ? sessionReminder(preset, list, now, data.session.planned_minutes) : null
  const reminderKey =
    reminder && reminder.remainingMs <= 0 ? `${reminder.phase}-${segments.at(-1)?.id}` : null

  useAppAway(data?.session.id, Boolean(open), (sec) => {
    if (data) void writer.away(data, sec)
  })

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
  // A knowledge check runs on its own screen (a series of recall gates).
  if (check?.sessionId === data.session.id) return <Navigate to="/session/review" replace />

  const { session } = data
  const active = activeMs(list, now)
  const pauses = pauseStats(list, now)
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
      void writer.pause(
        data,
        breakEndsAt(preset, closed, now),
        notifyBreak
          ? { title: t('notify.push.breakEndTitle'), body: t('notify.push.breakEndBody') }
          : null,
      )
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

  const planned = session.planned_minutes
  const progress = planned
    ? active / (planned * MINUTE)
    : reminder && reminder.phase !== 'free' && reminder.totalMs > 0
      ? 1 - reminder.remainingMs / reminder.totalMs
      : (active % (60 * MINUTE)) / (60 * MINUTE)
  const due = reminder !== null && reminder.phase !== 'free' && reminder.remainingMs <= 0
  const tutorUnit = picked?.unit.kind === 'chapter' ? picked.unit.id : null
  const askTutor = () => {
    if (tutorUnit) navigate(`/tutor/${tutorUnit}`)
    else {
      setTutorAfterPick(true)
      setPicker(true)
    }
  }

  // Tajmer · A Noćna sova (boards TajmerA, TajmerTutor, TajmerPauza, SesijaJedinice): the whole
  // screen is the night sky; the cream band at the bottom holds offers and "Završi sesiju".
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-brand-strong text-ground">
      <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col items-center pt-[env(safe-area-inset-top)]">
        <div className="mt-3 flex h-14 items-center justify-between self-stretch px-3">
          <button
            type="button"
            onClick={() => goBack(navigate, '/')}
            className="flex h-11 items-center gap-1 px-2 text-[15px] font-semibold"
          >
            <ChevronLeftIcon size={20} />
            {t('nav.today')}
          </button>
          <button
            type="button"
            onClick={() => setTimerSheet(true)}
            aria-label={t('session.timer.settings')}
            className="flex h-11 items-center"
          >
            <span className="flex h-8 items-center rounded-full bg-ground/12 px-3 text-[13px] font-bold">
              {session.mode ? t(`session.mode.${session.mode}`) : t('session.timer.settings')}
            </span>
          </button>
        </div>

        {pending > 0 && !online && (
          <div
            role="status"
            className="mx-4 flex min-h-10 items-center self-stretch rounded-[12px] bg-ground/12 px-3 py-1.5 text-[13px] font-semibold"
          >
            {t('session.timer.savedOffline')}
          </div>
        )}

        <div className="mt-6 flex max-w-full flex-col items-center gap-0.5 px-6 text-center">
          <span className="line-clamp-2 font-display text-[22px] leading-tight font-bold">
            {picked ? unitTitle(picked.unit) : (subject?.name ?? t('session.title'))}
          </span>
          {picked && <span className="text-[15px] text-ground/75">{subject?.name}</span>}
        </div>

        <span
          className={cn(
            'mt-3.5 text-[13px] font-bold',
            open ? 'text-ground/75' : 'text-brand-soft',
          )}
        >
          {open ? t('session.timer.running') : t('session.timer.paused')}
        </span>
        <span
          role="timer"
          aria-label={t('session.timer.studied')}
          className={cn(
            'mt-1 font-display text-[88px] leading-none font-extrabold tracking-[-0.04em] tabular-nums min-[380px]:text-[96px]',
            !open && 'opacity-60',
          )}
        >
          {formatClock(active)}
        </span>
        <span className="mt-1.5 px-6 text-center text-[15px] font-semibold text-ground/75 tabular-nums">
          {reminder && !due
            ? reminderText(t, reminder, preset)
            : planned
              ? t('session.timer.ofPlanned', { min: planned })
              : t('session.timer.free')}
        </span>
        {due && (
          <span
            role="status"
            className="mt-3 rounded-[16px] bg-warning-soft px-[18px] py-3 text-[15px] font-bold text-warning-ink"
          >
            {reminderText(t, reminder!, preset)}
          </span>
        )}
        <div
          role="img"
          aria-label={t('session.timer.studied')}
          className="mx-10 mt-[18px] h-2.5 self-stretch overflow-hidden rounded-[5px] bg-ground/16"
        >
          <span
            className="block h-full rounded-[5px] bg-brand-soft"
            style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }}
          />
        </div>
        <span className="mt-3 text-[13px] text-ground/70 tabular-nums">
          {t('session.timer.segments', { count: segments.length })}
          {' · '}
          {t('session.timer.pauseTotal', { count: Math.round(pauses.ms / MINUTE) })}
        </span>

        <div className="mt-7 flex w-full max-w-[326px] items-center justify-between">
          <SideButton
            label={t('session.distracted')}
            badge={session.distractions}
            onClick={() => {
              void writer.distracted(data)
              navigator.vibrate?.(30)
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="7" y="3" width="10" height="18" rx="2.5" />
              <path d="M11 18h2" />
            </svg>
          </SideButton>
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? t('session.timer.pause') : t('session.timer.resume')}
            className="flex size-24 items-center justify-center rounded-full bg-ground text-brand-strong shadow-[0_12px_28px_rgb(10_20_40/0.35)]"
          >
            {open ? (
              <svg
                width="26"
                height="30"
                viewBox="0 0 14 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="1" y="1" width="4" height="14" rx="1.5" />
                <rect x="9" y="1" width="4" height="14" rx="1.5" />
              </svg>
            ) : (
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7 4.5V19.5L19.5 12Z" />
              </svg>
            )}
          </button>
          <SideButton label={t('session.units.short')} onClick={() => setPicker(true)}>
            <BookIcon size={22} />
          </SideButton>
        </div>

        <button
          type="button"
          onClick={askTutor}
          className="mt-7 flex h-[52px] items-center gap-2.5 rounded-full bg-subject-lavender-soft pr-[22px] pl-4 text-base font-bold text-subject-lavender-ink"
        >
          <SparkleIcon size={20} />
          {t('tutor.entry.ask')}
        </button>
        <span className="mt-2.5 text-[13px] text-ground/70">{t('tutor.entry.askSub')}</span>

        <section className="relative mt-auto flex w-full flex-col gap-3 self-stretch bg-ground px-5 pt-8 pb-[calc(28px+env(safe-area-inset-bottom))] text-ink">
          <svg
            width="390"
            height="40"
            viewBox="0 0 390 40"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-x-0 -top-[39px] h-10 w-full"
          >
            <path
              d="M0 22 C 48 2, 104 2, 150 18 C 176 28, 214 28, 240 18 C 286 2, 342 2, 390 22 V40 H0 Z"
              className="fill-ground"
            />
          </svg>
          <SessionSummary sessionId={session.id} unit={picked?.unit ?? null} />
          {pickedId && <LinkedQuestionsOffer unitId={pickedId} />}
          {pickedId && <SessionQuizOffer unitId={pickedId} />}
          <button
            type="button"
            // Finishing or discarding only happens here, and never on one stray tap (Sprint 12).
            onClick={() => setEndSheet(true)}
            className="h-14 rounded-[18px] text-base font-bold text-brand-strong shadow-[inset_0_0_0_1.5px_var(--color-brand)]"
          >
            {t('session.timer.finishSession')}
          </button>
          {picked && (
            <Link
              to={`/subjects/${session.subject_id}/sources/${picked.source.source.id}/units/${picked.unit.id}`}
              className="flex h-11 items-center justify-center gap-2 text-[15px] font-semibold text-brand"
            >
              <PencilIcon size={18} />
              {t('session.units.note')}
            </Link>
          )}
        </section>
      </div>

      <TimerSheet open={timerSheet} onOpenChange={setTimerSheet} data={data} />
      <UnitPickerSheet
        open={picker}
        onOpenChange={(o) => {
          setPicker(o)
          if (!o) setTutorAfterPick(false)
        }}
        sources={sources}
        selected={pickedId}
        onPick={(id) => {
          pick(id)
          setPicker(false)
          const unit = findUnit(sources, id)?.unit
          if (tutorAfterPick && id && unit?.kind === 'chapter') navigate(`/tutor/${id}`)
          setTutorAfterPick(false)
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

/** A side control of the timer (Ometena sam, Jedinica): a round icon button and its label. */
function SideButton({
  label,
  badge = 0,
  onClick,
  children,
}: {
  label: string
  badge?: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-[88px] flex-col items-center gap-2 text-ground"
    >
      <span className="relative flex size-[60px] items-center justify-center rounded-full bg-ground/12">
        {children}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ai px-1 text-[11px] font-bold text-ai-ink tabular-nums">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[13px] font-bold text-ground/82">{label}</span>
    </button>
  )
}

/** The reminder line under the time: break, back to work, a free pause, or the session's end. */
function reminderText(t: TFunction, reminder: SessionReminder, preset: Preset): string {
  const due = reminder.phase !== 'free' && reminder.remainingMs <= 0
  switch (reminder.phase) {
    case 'free':
      return t('session.timer.freePause', { time: formatClock(reminder.elapsedMs ?? 0) })
    case 'end':
      return due
        ? t('session.timer.endDue')
        : t('session.timer.endIn', { time: formatClock(reminder.remainingMs) })
    case 'work':
      return due
        ? t('session.timer.breakDue')
        : t('session.timer.breakIn', {
            mode: presetName(t, preset),
            time: formatClock(reminder.remainingMs),
          })
    case 'break':
      return due
        ? t('session.timer.backDue')
        : t('session.timer.backIn', { time: formatClock(reminder.remainingMs) })
  }
}

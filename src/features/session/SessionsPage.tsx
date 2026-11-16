import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { EmptyCard } from '@/components/EmptyCard'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '@/components/icons'
import { InHeader } from '@/app/layout/ScreenHeader'
import { usePlanBlocks } from '@/features/plan/api'
import { blocksOn, blockTitle, useGoalTitle, useUnitIndex } from '@/features/plan/model'
import { formatDuration } from '@/features/sources/format'
import { formatClock } from '@/lib/schedule'
import { unitTitle } from './material'
import { weekBars, weekDays } from './week'
import { SwipeRow } from '@/components/SwipeRow'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { paletteOf } from '@/features/subjects/colors'
import { useSubjects } from '@/features/subjects/api'
import {
  addDays,
  localDay,
  startOfWeek,
  toDisplayDate,
  zonedInstant,
  type LocalDate,
} from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useSessions, useSessionWriter, type SessionListItem } from './api'
import { Chip } from './Chip'
import { sessionMinutes, STUDY_MODES } from './model'
import { hhmm } from './segmentDrafts'
import { useNow } from './useNow'
import { useSessionUi } from './store'
import type { StudyMode } from '@/lib/estimates/calibration'

/**
 * Sesije (board Sesije): one week at a time, ‹ › between weeks. The header shows planned and done
 * minutes per day on one scale; below are the week's sessions by day, or the plan for next week.
 * Swipe left deletes a session (with undo; the calibration is recomputed).
 */
export function SessionsPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [params, setParams] = useSearchParams()
  const subjectId = params.get('subject')
  const boundary = useDayBoundary()
  const { data: sessions, isPending } = useSessions()
  const { data: blocks = [] } = usePlanBlocks(boundary)
  const { data: subjects } = useSubjects()
  const units = useUnitIndex()
  const goalTitle = useGoalTitle()
  const [adding, setAdding] = useState(false)
  const writer = useSessionWriter()
  const queryClient = useQueryClient()
  const needsRecalibration = useSessionUi((s) => s.needsRecalibration)
  const [now] = useState(() => new Date())
  const today = localDay(now, boundary)
  const thisWeek = startOfWeek(today)
  const [week, setWeek] = useState(thisWeek)
  const [expanded, setExpanded] = useState<string | null>(null)
  const isNext = week > thisWeek
  const weekEnd = addDays(week, 6)

  const list = (sessions ?? []).filter((s) => !subjectId || s.subject_id === subjectId)
  const dayOf = (s: SessionListItem) => localDay(new Date(s.started_at), boundary)
  const shownBlocks = blocks.filter((b) => !subjectId || b.subject_id === subjectId)
  const done = new Map<LocalDate, number>()
  for (const s of list) done.set(dayOf(s), (done.get(dayOf(s)) ?? 0) + sessionMinutes(s))
  const planned = new Map<LocalDate, number>()
  for (const b of shownBlocks)
    planned.set(b.on_date, (planned.get(b.on_date) ?? 0) + b.planned_minutes)
  const days = weekDays(week, planned, done)
  const bars = weekBars(days)
  const sum = (key: 'planned' | 'done') => days.reduce((a, d) => a + d[key], 0)
  const inWeek = list.filter((s) => dayOf(s) >= week && dayOf(s) <= weekEnd)
  const earliest = [...list.map(dayOf), ...shownBlocks.map((b) => b.on_date)].sort()[0] ?? today
  const usedSubjects = (subjects ?? []).filter(
    (x) => !x.archived || (sessions ?? []).some((s) => s.subject_id === x.id),
  )
  const subjectOf = (id: string) => subjects?.find((x) => x.id === id)
  const dur = (m: number) => formatDuration(t, m)
  const fmtDay = (d: LocalDate, pattern: string) =>
    format(toDisplayDate(d), pattern, { locale: dateFnsLocales[locale] })
  const label =
    week.slice(0, 7) === weekEnd.slice(0, 7)
      ? `${fmtDay(week, 'd.')}–${fmtDay(weekEnd, locale === 'en' ? 'd MMM' : 'd. MMM')}`
      : `${fmtDay(week, locale === 'en' ? 'd MMM' : 'd. MMM')} – ${fmtDay(weekEnd, locale === 'en' ? 'd MMM' : 'd. MMM')}`
  const summary = isNext
    ? t('session.week.plannedOnly', { planned: dur(sum('planned')) })
    : [
        sum('planned') > 0
          ? t('session.week.doneOf', { done: dur(sum('done')), planned: dur(sum('planned')) })
          : dur(sum('done')),
        t('session.week.count', { count: inWeek.length }),
      ].join(' · ')
  const weekdays = days.map((d) => fmtDay(d.day, 'EEEEE'))
  const aria = days
    .map((d) =>
      t(isNext ? 'session.week.ariaPlan' : 'session.week.ariaDay', {
        day: fmtDay(d.day, 'EEEE'),
        done: dur(d.done),
        planned: dur(d.planned),
      }),
    )
    .join(', ')

  // Monday to Sunday, morning to evening: the same direction as the bars.
  const sections = isNext
    ? days.map((d) => ({
        day: d.day,
        total: d.planned ? dur(d.planned) : t('session.week.free'),
        sessions: [] as SessionListItem[],
        blocks: blocksOn(shownBlocks, d.day),
      }))
    : days
        .filter((d) => inWeek.some((s) => dayOf(s) === d.day))
        .map((d) => ({
          day: d.day,
          total: d.planned
            ? t('session.week.doneOf', { done: dur(d.done), planned: dur(d.planned) })
            : dur(d.done),
          sessions: inWeek
            .filter((s) => dayOf(s) === d.day)
            .sort((a, b) => a.started_at.localeCompare(b.started_at)),
          blocks: [],
        }))
  const show = isNext ? 3 : 4
  const open = expanded === week
  const visible = open ? sections : sections.slice(0, show)
  const rest = sections.length - show

  const goWeek = (w: LocalDate) => {
    setWeek(w)
    setExpanded(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <InHeader>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[44px] leading-none font-bold tracking-[-0.03em]">
            {t('session.history.title')}
          </h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t('session.week.prev')}
              disabled={week <= startOfWeek(earliest)}
              onClick={() => goWeek(addDays(week, -7))}
              className="flex size-11 items-center justify-center disabled:opacity-35"
            >
              <ChevronLeftIcon size={20} />
            </button>
            <span className="min-w-[92px] text-center text-[15px] font-bold tabular-nums">
              {label}
            </span>
            <button
              type="button"
              aria-label={t('session.week.next')}
              disabled={isNext}
              onClick={() => goWeek(addDays(week, 7))}
              className="flex size-11 items-center justify-center disabled:opacity-35"
            >
              <ChevronRightIcon size={20} />
            </button>
          </div>
        </div>
        <span role="status" className="mt-1.5 block text-base text-ground/80 tabular-nums">
          {summary}
        </span>
        <div role="img" aria-label={aria} className="mt-[18px] flex gap-2">
          {days.map((d, i) => (
            <div key={d.day} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="relative h-[72px]">
                <span
                  className={cn(
                    'absolute inset-x-0 bottom-0 rounded-md bg-ground/25',
                    d.day === today && 'shadow-[inset_0_0_0_1.5px_rgb(251_245_230/0.7)]',
                  )}
                  style={{ height: bars[i]!.planned }}
                />
                {!isNext && (
                  <span
                    className="absolute inset-x-0 bottom-0 rounded-md bg-ground transition-[height] duration-300 motion-reduce:transition-none"
                    style={{ height: bars[i]!.done }}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-center text-xs uppercase',
                  d.day === today ? 'font-extrabold' : 'font-bold',
                  d.day > today && !isNext ? 'text-ground/75' : 'text-ground',
                )}
              >
                {weekdays[i]}
              </span>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="mt-2.5 flex gap-4 text-[13px] text-ground/85">
          {!isNext && (
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-ground" />
              {t('session.week.done')}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-ground/25" />
            {t('session.week.planned')}
          </span>
          {week !== thisWeek && (
            <button
              type="button"
              onClick={() => goWeek(thisWeek)}
              className="-my-3 ml-auto h-11 font-bold text-ground"
            >
              {t('session.week.now')}
            </button>
          )}
        </div>
      </InHeader>

      {usedSubjects.length > 1 && (
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
          <Chip selected={!subjectId} onClick={() => setParams({}, { replace: true })}>
            {t('session.history.all')}
          </Chip>
          {usedSubjects.map((x) => (
            <Chip
              key={x.id}
              selected={x.id === subjectId}
              onClick={() => setParams({ subject: x.id }, { replace: true })}
            >
              <span className="whitespace-nowrap">{x.name}</span>
            </Chip>
          ))}
        </div>
      )}

      {isNext && (
        <div className="flex items-baseline justify-between px-1 pt-1">
          <h2 className="font-sans text-[15px] font-bold">{t('session.week.planned')}</h2>
          <span className="text-[13px] font-semibold text-ink-secondary tabular-nums">
            {dur(sum('planned'))}
          </span>
        </div>
      )}

      {!isPending && !isNext && sections.length === 0 && (
        <EmptyCard title={t('session.history.emptyTitle')}>
          {t(week === thisWeek ? 'session.history.empty' : 'session.week.emptyWeek')}
        </EmptyCard>
      )}

      {visible.map((section) => (
        <section key={section.day} className="mt-4 flex flex-col gap-2 first-of-type:mt-1">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-sans text-[15px] font-bold first-letter:uppercase">
              {section.day === today
                ? t('session.week.today')
                : fmtDay(section.day, locale === 'en' ? 'EEEE, MMM d' : 'EEEE, d. MMM')}
            </h2>
            <span className="text-[13px] font-semibold text-ink-secondary tabular-nums">
              {section.total}
            </span>
          </div>
          {isNext && section.blocks.length === 0 && (
            <span className="px-1 text-sm text-ink-secondary">{t('session.week.freeDay')}</span>
          )}
          {section.blocks.map((b) => (
            <div
              key={b.id}
              className="flex min-h-16 items-center gap-3 rounded-[18px] py-2.5 pr-3 pl-3.5 shadow-[inset_0_0_0_1.5px_var(--color-hairline)]"
            >
              <span className="w-11 shrink-0 text-sm font-bold text-brand-strong tabular-nums">
                {b.start_min !== null ? formatClock(b.start_min) : ''}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-base font-bold">
                  {blockTitle(t, b, units, goalTitle(b.assessment_id ?? b.deadline_id ?? ''))}
                </span>
                <SubjectLine color={subjectOf(b.subject_id)?.color ?? null}>
                  {subjectOf(b.subject_id)?.name}
                </SubjectLine>
              </span>
              <span className="text-sm font-bold text-brand-strong tabular-nums">
                {dur(b.planned_minutes)}
              </span>
            </div>
          ))}
          {section.sessions.map((s) => {
            const subject = subjectOf(s.subject_id)
            const unitId = s.study_segments.find((g) => g.unit_id)?.unit_id
            const unit = unitId ? units.get(unitId)?.unit : undefined
            return (
              <SwipeRow
                key={s.id}
                className="rounded-[18px]"
                actions={[
                  {
                    id: 'delete',
                    label: t('swipe.delete'),
                    tone: 'danger',
                    icon: <TrashIcon size={18} />,
                    deferred: t('swipe.sessionDeleted'),
                    // The calibration is recomputed without it (as on the session screen).
                    run: async () => {
                      await writer.remove(s)
                      if (s.origin === 'timer') needsRecalibration(s.subject_id)
                      void queryClient.invalidateQueries({ queryKey: ['session', 'list'] })
                    },
                  },
                ]}
              >
                <Link
                  to={`/sessions/${s.id}`}
                  className="flex min-h-16 items-center gap-3 surface py-2.5 pr-3 pl-3.5"
                >
                  <span className="w-11 shrink-0 text-sm font-bold text-brand-strong tabular-nums">
                    {hhmm(new Date(s.started_at), boundary.timeZone)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-base font-bold">
                      {unit ? unitTitle(unit) : subject?.name}
                    </span>
                    <SubjectLine color={subject?.color ?? null}>
                      {[
                        unit && subject?.name,
                        dur(sessionMinutes(s)),
                        s.origin === 'manual' && t('session.week.manual'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </SubjectLine>
                  </span>
                  {s.focus && (
                    <span
                      className={cn(
                        'flex h-6 shrink-0 items-center rounded-lg px-2 text-xs font-bold',
                        FOCUS_TAG[s.focus as 1 | 2 | 3],
                      )}
                    >
                      {t(`session.end.focusLevel.${s.focus as 1 | 2 | 3}`)}
                    </span>
                  )}
                </Link>
              </SwipeRow>
            )
          })}
        </section>
      ))}

      {rest > 0 && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setExpanded(open ? null : week)}
          className="mt-4 flex h-[52px] items-center justify-center rounded-[18px] text-[15px] font-bold text-brand-strong shadow-[inset_0_0_0_1.5px_rgb(var(--hoot-brand-rgb)/0.35)]"
        >
          {open ? t('session.week.less') : t('session.week.more', { count: rest })}
        </button>
      )}
      {week === thisWeek && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 flex h-[52px] items-center justify-center gap-2 rounded-[18px] text-[15px] font-bold text-brand-strong shadow-[inset_0_0_0_1.5px_rgb(var(--hoot-brand-rgb)/0.35)]"
        >
          <PlusIcon size={18} />
          {t('session.week.addManual')}
        </button>
      )}

      <AddSessionSheet open={adding} onOpenChange={setAdding} subjectId={subjectId} />
    </div>
  )
}

/** Focus 1–3 as the board's tags: Slab, Ok, Odličan. */
const FOCUS_TAG = {
  1: 'bg-warning-soft text-warning-ink',
  2: 'bg-brand-soft text-brand-strong',
  3: 'bg-success-soft text-subject-green-ink',
} as const

function SubjectLine({ color, children }: { color: string | null; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-secondary">
      <span className={cn('size-2 shrink-0 rounded-full', paletteOf(color).bar)} />
      <span className="truncate tabular-nums">{children}</span>
    </span>
  )
}

/** "+ Dodaj sesiju": studied without the timer. Next comes the end-of-session form. */
function AddSessionSheet({
  open,
  onOpenChange,
  subjectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjectId: string | null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const boundary = useDayBoundary()
  const writer = useSessionWriter()
  const { data: subjects } = useSubjects()
  const active = (subjects ?? []).filter((s) => !s.archived)
  const [subject, setSubject] = useState<string | null>(subjectId)
  const now = useNow(60_000, open)
  const [today] = useState(() => new Date())
  const [date, setDate] = useState(() => localDay(today, boundary))
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [mode, setMode] = useState<StudyMode | null>('reading')
  const [busy, setBusy] = useState(false)

  const minutesOf = (x: string) => {
    const m = /^(\d{2}):(\d{2})$/.exec(x)
    return m ? Number(m[1]) * 60 + Number(m[2]) : null
  }
  const a = minutesOf(from)
  let b = minutesOf(to)
  if (a !== null && b !== null && b <= a) b += 1440
  const start = a === null ? null : zonedInstant(date, a, boundary.timeZone)
  const end = b === null ? null : zonedInstant(date, b, boundary.timeZone)
  const valid = Boolean(subject && start && end && end.getTime() <= now.getTime())

  const next = async () => {
    if (!valid || busy) return
    setBusy(true)
    const id = await writer.addManual({ subjectId: subject!, mode, start: start!, end: end! })
    onOpenChange(false)
    setBusy(false)
    navigate(`/session/${id}/end?from=history`)
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('session.history.addTitle')}
      subtitle={t('session.history.addSubtitle')}
    >
      <div className="flex flex-wrap gap-1.5" aria-label={t('session.start.subject')}>
        {active.map((s) => (
          <Chip key={s.id} selected={s.id === subject} onClick={() => setSubject(s.id)}>
            {s.name}
          </Chip>
        ))}
      </div>
      <label className="flex items-center justify-between gap-3 text-[15px] font-semibold">
        {t('session.history.date')}
        <input
          type="date"
          value={date}
          max={localDay(today, boundary)}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-11 rounded-[14px] bg-canvas px-3 text-[15px]"
        />
      </label>
      <div className="flex items-center gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
          {t('session.history.from')}
          <input
            type="time"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-11 rounded-[14px] bg-canvas px-3 text-[15px]"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
          {t('session.history.to')}
          <input
            type="time"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-11 rounded-[14px] bg-canvas px-3 text-[15px]"
          />
        </label>
      </div>
      <div role="group" aria-label={t('session.mode.label')} className="flex flex-wrap gap-2">
        {STUDY_MODES.map((m) => (
          <Chip
            key={m}
            tone="brand"
            selected={mode === m}
            onClick={() => setMode(mode === m ? null : m)}
          >
            {t(`session.mode.${m}`)}
          </Chip>
        ))}
      </div>
      <span className="text-xs leading-[1.45] text-ink-muted">
        {t('session.history.manualHint')}
      </span>
      <button
        type="button"
        onClick={next}
        disabled={!valid || busy}
        className="h-14 rounded-full btn-primary text-base font-semibold disabled:opacity-50"
      >
        {t('session.history.next')}
      </button>
    </BottomSheet>
  )
}

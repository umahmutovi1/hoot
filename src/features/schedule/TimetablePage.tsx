import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { CameraIcon, ChevronRightIcon, PlusIcon } from '@/components/icons'
import { useAiAvailability } from '@/features/owl/api'
import { useOwlStore } from '@/features/owl/store'
import { useDayBoundary, useProfile, useUpdateProfile } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { localDay, toDisplayDate, weekdayOf } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { currentTeachingPeriod, formatClock, weeklyClassCount } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { usePeriods, useTimetable } from './api'
import { ClassSheet } from './ClassSheet'
import { CLASS_KIND_STYLE } from './format'
import { toClass, toPeriod, type TimetableRow } from './model'
import { useWeekdayNames } from './weekdays'

/** Raspored nastave: classes of the current teaching period, one weekday at a time. */
export function TimetablePage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const { data: periodRows = [] } = usePeriods()
  const { data: rows = [] } = useTimetable()
  const { data: subjects = [] } = useSubjects()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const names = useWeekdayNames('short')
  const aiReady = useAiAvailability().state === 'ready'
  const openSheet = useOwlStore((s) => s.openSheet)

  const teachingRows = periodRows.filter((p) => p.kind === 'teaching')
  const current = currentTeachingPeriod(today, periodRows.map(toPeriod))
  const currentRow = teachingRows.find((p) => p.id === current?.id)
  // Entries without a period (should not happen) still show, so nothing gets lost.
  const entries = rows.filter((r) => !current || r.period_id === current.id || !r.period_id)
  const weekend = [5, 6].filter((d) => entries.some((e) => e.weekday === d))
  const days = [0, 1, 2, 3, 4, ...weekend]
  const [day, setDay] = useState(() => {
    const w = weekdayOf(today)
    return w < 5 ? w : 0
  })
  const list = entries.filter((e) => e.weekday === day).sort((a, b) => a.start_min - b.start_min)
  const [sheet, setSheet] = useState<{ open: boolean; id?: string }>({ open: false })
  const recap = profile?.recap_after_lecture ?? true

  const addClass = () => (currentRow ? setSheet({ open: true }) : navigate('/settings/calendar'))

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold">{t('timetable.title')}</span>
        <button
          type="button"
          onClick={addClass}
          aria-label={t('timetable.add')}
          className="flex size-11 items-center justify-center rounded-full glass text-brand"
        >
          <PlusIcon size={18} strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-tight font-bold">{t('timetable.heading')}</h1>
        {current ? (
          <Link to="/settings/calendar" className="text-sm text-ink-muted">
            {t('timetable.periodLine', {
              title: current.title,
              date: format(toDisplayDate(current.endsOn), 'd. MMM', {
                locale: dateFnsLocales[locale],
              }),
              count: Math.round(weeklyClassCount(entries.map(toClass))),
            })}
          </Link>
        ) : null}
      </div>

      {aiReady && (
        <button
          type="button"
          onClick={() => {
            openSheet('timetable')
            navigate('/chat')
          }}
          className="flex items-center gap-3 rounded-card glass p-3.5 text-left"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
            <CameraIcon size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t('timetable.photoTitle')}</span>
            <span className="text-xs text-ink-muted">{t('timetable.photoHint')}</span>
          </span>
          <ChevronRightIcon size={18} className="text-ink-subtle" />
        </button>
      )}

      {!current && (
        <Link to="/settings/calendar" className="flex items-center gap-3 rounded-card glass p-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t('timetable.noPeriodTitle')}</span>
            <span className="text-xs text-ink-muted">{t('timetable.noPeriodBody')}</span>
          </div>
          <ChevronRightIcon size={18} className="text-ink-subtle" />
        </Link>
      )}

      <div role="tablist" className="flex gap-1.5">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={day === d}
            onClick={() => setDay(d)}
            className={cn(
              'h-11 flex-1 rounded-full text-sm font-semibold',
              day === d ? 'bg-ink text-white' : 'glass text-ink',
            )}
          >
            {names[d]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {list.map((e) => (
          <ClassCard
            key={e.id}
            entry={e}
            subject={subjects.find((s) => s.id === e.subject_id)}
            onOpen={() => setSheet({ open: true, id: e.id })}
          />
        ))}
        {list.length === 0 && (
          <p className="rounded-[22px] glass p-5 text-center text-sm text-ink-muted">
            {t('timetable.dayEmpty')}
          </p>
        )}
      </div>

      <h2 className="mt-2 text-lg font-semibold">{t('timetable.howTitle')}</h2>
      <div className="flex flex-col rounded-card glass px-4 py-1.5">
        <div className="flex items-center justify-between gap-3 border-b border-canvas py-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px]">{t('timetable.busyTitle')}</span>
            <span className="text-xs text-ink-muted">{t('timetable.busyHint')}</span>
          </span>
          <span className="text-xs font-semibold text-success">{t('timetable.always')}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px]">{t('timetable.recapTitle')}</span>
            <span className="text-xs text-ink-muted">{t('timetable.recapHint')}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={recap}
            aria-label={t('timetable.recapTitle')}
            onClick={() => updateProfile.mutate({ recap_after_lecture: !recap })}
            className={cn(
              'flex h-8 w-[52px] shrink-0 rounded-full p-[3px] transition-colors',
              recap ? 'justify-end bg-brand' : 'justify-start bg-radio-ring',
            )}
          >
            <span className="size-[26px] rounded-full glass" />
          </button>
        </div>
      </div>

      <ClassSheet
        entry={rows.find((r) => r.id === sheet.id)}
        periods={[...teachingRows].sort((a, b) =>
          a.id === current?.id ? -1 : b.id === current?.id ? 1 : 0,
        )}
        weekday={day}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
    </div>
  )
}

function ClassCard({
  entry,
  subject,
  onOpen,
}: {
  entry: TimetableRow
  subject?: { name: string; color: string | null }
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const kind = [
    t(`timetable.kind.${entry.kind}`),
    entry.week_parity && t(`timetable.parityShort.${entry.week_parity as 'odd' | 'even'}`),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3.5 rounded-[22px] glass px-4 py-3.5 text-left"
    >
      <div className="flex w-[46px] flex-col items-end text-[13px]">
        <span className="font-bold">{formatClock(entry.start_min)}</span>
        <span className="text-ink-subtle">{formatClock(entry.end_min)}</span>
      </div>
      <span
        className={cn('w-1 self-stretch rounded-full', paletteOf(subject?.color ?? null).bar)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-semibold">
          {subject?.name ?? t('timetable.noSubject')}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'rounded-lg px-2 py-[3px] text-[11px] font-semibold',
              CLASS_KIND_STYLE[entry.kind],
            )}
          >
            {kind}
          </span>
          {entry.location && <span className="text-xs text-ink-muted">{entry.location}</span>}
        </div>
      </div>
    </button>
  )
}

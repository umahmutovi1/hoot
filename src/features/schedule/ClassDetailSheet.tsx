import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { CapIcon, ChevronRightIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { DayClass } from '@/features/plan/agenda'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { paletteOf } from '@/features/subjects/colors'
import { localDay, toDisplayDate, type LocalDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useDeleteLectureLog, useLectureLogs, usePeriods, useSaveLectureLogs } from './api'
import { ClassSheet } from './ClassSheet'
import { clockRange } from './format'
import { LectureSheet } from './LectureSheet'

/** Details of one class on one date: tapped in the calendar's day, week or month view. */
export function ClassDetailSheet({
  item,
  date,
  onClose,
}: {
  item: DayClass | null
  date: LocalDate
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const boundary = useDayBoundary()
  const [today] = useState(() => localDay(new Date(), boundary))
  const { data: logs = [] } = useLectureLogs()
  const { data: periods = [] } = usePeriods()
  const save = useSaveLectureLogs()
  const remove = useDeleteLectureLog()
  const [lectureOpen, setLectureOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const entry = item?.entry
  const subject = item?.subject
  const palette = paletteOf(subject?.color ?? null)
  const cancelLog = logs.find(
    (l) => l.cancelled && l.on_date === date && l.timetable_entry_id === entry?.id,
  )
  const reached = logs.find(
    (l) => !l.cancelled && l.on_date === date && l.timetable_entry_id === entry?.id,
  )
  const period = periods.find((p) => p.id === entry?.row.period_id)

  const cancel = () => {
    if (!entry || !subject) return
    const logId = crypto.randomUUID()
    save.mutate({
      logs: [
        {
          id: logId,
          subject_id: subject.id,
          timetable_entry_id: entry.id,
          on_date: date,
          cancelled: true,
        },
      ],
      freeSlot: {
        id: crypto.randomUUID(),
        on_date: date,
        start_min: entry.startMin,
        end_min: entry.endMin,
        is_busy: false,
        lecture_log_id: logId,
      },
    })
  }

  const details = entry
    ? [
        [t('classDetail.room'), entry.row.location],
        [t('classDetail.weeks'), t(`timetable.parity.${entry.weekParity ?? 'all'}`)],
        [t('classDetail.period'), period?.title],
      ].filter((r): r is [string, string] => Boolean(r[1]))
    : []

  return (
    <>
      <BottomSheet
        open={item !== null && !lectureOpen && !editOpen}
        onOpenChange={(open) => !open && onClose()}
        title={subject?.name ?? t('timetable.noSubject')}
        subtitle={
          entry
            ? [
                t(`timetable.kind.${entry.kind}`),
                format(toDisplayDate(date), 'EEEE, d. MMM', { locale: dateFnsLocales[locale] }),
                clockRange(entry.startMin, entry.endMin),
              ].join(' · ')
            : undefined
        }
      >
        {entry && (
          <div className="flex flex-col gap-3.5">
            {item.cancelled && (
              <span className="self-start rounded-lg bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-ink">
                {t('classDetail.cancelled')}
              </span>
            )}
            {details.length > 0 && (
              <div className="flex flex-col rounded-[18px] bg-canvas px-4 py-1">
                {details.map(([label, value], i) => (
                  <div
                    key={label}
                    className={cn(
                      'flex justify-between gap-3 py-2.5 text-sm',
                      i > 0 && 'border-t border-hairline',
                    )}
                  >
                    <span className="text-ink-muted">{label}</span>
                    <span className="text-right font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            )}
            {subject && (
              <Link
                to={`/subjects/${subject.id}`}
                className={cn('flex items-center gap-3 rounded-[18px] px-4 py-3', palette.soft)}
              >
                <CapIcon size={18} className={palette.deepText} />
                <span className={cn('flex-1 text-sm font-semibold', palette.inkText)}>
                  {t('classDetail.openSubject')}
                </span>
                <ChevronRightIcon size={16} className={palette.deepText} />
              </Link>
            )}
            {entry.kind === 'lecture' && !item.cancelled && date <= today && subject && (
              <Button
                type="button"
                size="pill"
                onClick={() => setLectureOpen(true)}
                className="bg-brand text-white hover:bg-brand-strong"
              >
                {reached ? t('classDetail.changeReached') : t('lectures.title')}
              </Button>
            )}
            <div className="flex items-center justify-between">
              {cancelLog ? (
                <button
                  type="button"
                  onClick={() => remove.mutate(cancelLog.id)}
                  className="min-h-11 text-sm font-semibold text-brand"
                >
                  {t('classDetail.restore')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancel}
                  className="min-h-11 text-sm font-semibold text-brand"
                >
                  {t('classDetail.cancel')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="min-h-11 text-sm font-medium text-ink-muted"
              >
                {t('classDetail.edit')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
      {subject && entry && (
        <LectureSheet
          subjectId={subject.id}
          subjectName={subject.name}
          entry={entry.row}
          date={date}
          context={t('lectures.contextDate', {
            kind: t(`timetable.kind.${entry.kind}`).toLowerCase(),
            date: format(toDisplayDate(date), 'd. MMM', { locale: dateFnsLocales[locale] }),
            time: clockRange(entry.startMin, entry.endMin),
          })}
          open={lectureOpen}
          onOpenChange={(open) => {
            setLectureOpen(open)
            if (!open) onClose()
          }}
        />
      )}
      {entry && (
        <ClassSheet
          entry={entry.row}
          periods={periods.filter((p) => p.kind === 'teaching')}
          weekday={entry.weekday}
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open)
            if (!open) onClose()
          }}
        />
      )}
    </>
  )
}

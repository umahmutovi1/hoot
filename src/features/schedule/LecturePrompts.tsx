import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CapIcon } from '@/components/icons'
import { useDayBoundary } from '@/features/settings/profile'
import { useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { diffDays, localDay, wallClock } from '@/lib/day'
import { lecturesToLog } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { clockRange } from './format'
import { LectureSheet } from './LectureSheet'
import { readSkippedLectures } from './lectureSkips'
import { useScheduleData } from './useScheduleData'

/**
 * "Predavanje iz Signala je završilo. Dokle ste stigli?" on Today, for every lecture of the
 * local day that has ended and has no log yet. The card stays until the day ends.
 */
export function LecturePrompts() {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const data = useScheduleData()
  const { data: subjects = [] } = useSubjects()
  const [now] = useState(() => new Date())
  const [skipped, setSkipped] = useState(readSkippedLectures)
  const [open, setOpen] = useState<string | null>(null)

  const today = localDay(now, boundary)
  const wall = wallClock(now, boundary.timeZone)
  // After midnight (before the day boundary) the lecture day is yesterday: all of it has ended.
  const calendarToday = `${wall.year}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`
  const nowMin = wall.minutes + diffDays(today, calendarToday) * 1440
  const logged = new Set(
    data.logRows
      .filter((l) => l.timetable_entry_id)
      .map((l) => `${l.timetable_entry_id}:${l.on_date}`),
  )
  const pending = lecturesToLog(today, nowMin, data.classes, data.periods, logged, skipped)

  return (
    <>
      {pending.map((entry) => {
        const subject = subjects.find((s) => s.id === entry.subjectId)
        if (!subject) return null
        const palette = paletteOf(subject.color)
        return (
          <div key={entry.id} className="flex items-center gap-3 rounded-card glass p-3.5 pl-4">
            <div
              className={cn(
                'flex size-[38px] shrink-0 items-center justify-center rounded-[12px] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]',
                palette.bar,
              )}
            >
              <CapIcon size={17} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">
                {t('lectures.ended', { subject: subject.name })}
              </span>
              <span className="text-xs text-ink-muted">
                {t('lectures.promptSub', { time: clockRange(entry.startMin, entry.endMin) })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(entry.id)}
              className="flex h-10 items-center rounded-full btn-primary px-4 text-sm font-semibold"
            >
              {t('lectures.enter')}
            </button>
            <LectureSheet
              subjectId={subject.id}
              subjectName={subject.name}
              entry={entry.row}
              date={today}
              context={t('lectures.context', {
                kind: t(`timetable.kind.${entry.kind}`).toLowerCase(),
                time: clockRange(entry.startMin, entry.endMin),
              })}
              open={open === entry.id}
              onOpenChange={(o) => setOpen(o ? entry.id : null)}
              onSkip={() => setSkipped(readSkippedLectures())}
            />
          </div>
        )
      })}
    </>
  )
}

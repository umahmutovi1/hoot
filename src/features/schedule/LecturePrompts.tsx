import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CapIcon } from '@/components/icons'
import { paletteOf } from '@/features/subjects/colors'
import type { LocalDate } from '@/lib/day'
import { cn } from '@/lib/utils'
import { clockRange } from './format'
import { LectureSheet } from './LectureSheet'
import type { PendingLecture } from './usePendingLectures'

/** "Predavanje iz Signala je završilo. Dokle ste stigli?" on Today. */
export function LecturePromptCard({
  lecture,
  today,
  onSkip,
}: {
  lecture: PendingLecture
  today: LocalDate
  onSkip: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { entry, subject } = lecture
  const palette = paletteOf(subject.color)
  return (
    <div className="flex items-center gap-3 rounded-card glass p-3.5 pl-4">
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
        onClick={() => setOpen(true)}
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
        open={open}
        onOpenChange={setOpen}
        onSkip={onSkip}
      />
    </div>
  )
}

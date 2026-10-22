import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { cn } from '@/lib/utils'
import { dayMarkers } from './calendar'

/** Activity dots under a day (exams, possible exams, deadlines), as in the month grid. */
export function DayDots({
  date,
  max = 3,
  light,
  planned = false,
}: {
  date: Date
  max?: number
  light?: boolean
  /** The plan has study blocks that day. */
  planned?: boolean
}) {
  const { data: subjects = [] } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  const markers = dayMarkers(date, subjects, deadlines, max)
  return (
    <span aria-hidden="true" className="flex h-[7px] items-center gap-[3px]">
      {markers.visible.map((m) => (
        <span
          key={`${m.kind}-${m.id}`}
          className={cn(
            'size-[6px] rounded-full',
            m.kind === 'exam' && paletteOf(m.color).bar,
            m.kind === 'possible' && 'border-[1.5px]',
            m.kind === 'possible' && (light ? 'bg-ink' : 'glass'),
            m.kind === 'possible' && paletteOf(m.color).border,
            m.kind === 'deadline' && 'bg-warning',
          )}
        />
      ))}
      {planned && <span className="size-[6px] rounded-full bg-brand-accent" />}
      {markers.more > 0 && (
        <span
          className={cn(
            'text-[9px] leading-none font-bold',
            light ? 'text-white/80' : 'text-ink-muted',
          )}
        >
          +{markers.more}
        </span>
      )}
    </span>
  )
}

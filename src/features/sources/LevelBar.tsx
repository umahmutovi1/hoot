import { cn } from '@/lib/utils'

const CHAPTER = ['bg-hairline', 'bg-level-1', 'bg-brand-accent', 'bg-brand'] as const
const QUESTION = [
  'bg-subject-blue-track',
  'bg-question-1',
  'bg-question-1',
  'bg-subject-blue',
] as const

/** Stacked bar of minutes per level, done first (Izvor and Predmet mockups). */
export function LevelBar({
  minutes,
  questions = false,
  className,
}: {
  /** Minutes at level 0, 1, 2, 3. */
  minutes: [number, number, number, number]
  questions?: boolean
  className?: string
}) {
  const colors = questions ? QUESTION : CHAPTER
  const order = [3, 2, 1, 0] as const
  const total = minutes.reduce((s, m) => s + m, 0)
  return (
    <div aria-hidden="true" className={cn('flex gap-[3px]', className)}>
      {total === 0 ? (
        <span className={cn('flex-1 rounded-[4px]', colors[0])} />
      ) : (
        order
          .filter((level) => minutes[level] > 0)
          .map((level) => (
            <span
              key={level}
              style={{ flexGrow: minutes[level] }}
              className={cn('basis-0 rounded-[4px]', colors[level])}
            />
          ))
      )}
    </div>
  )
}

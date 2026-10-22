import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { useSources } from '@/features/sources/api'
import { materialOf, subjectMaterialProgress } from '@/features/sources/model'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { nextAssessment, type SubjectWithAssessments } from '@/features/subjects/model'
import { diffDays, localDay, type LocalDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { useDayBoundary } from '@/features/settings/profile'
import { cn } from '@/lib/utils'

/**
 * "Ispiti" on Today: the next exam of up to three subjects, soonest first, with how many days are
 * left and the material progress.
 */
/**
 * Days are counted from `today`, the local day at the day boundary (04:00), like the focus bar:
 * at 01:30 it is still yesterday.
 */
export function ExamTiles({ now, today }: { now: Date; today: LocalDate }) {
  const { t } = useTranslation()
  const { data: subjects = [] } = useSubjects()
  const upcoming = subjects
    .filter((s) => !s.archived)
    .map((s) => ({ subject: s, exam: nextAssessment(s.assessments, now) }))
    .filter((x) => x.exam)
    .sort((a, b) => a.exam!.at.localeCompare(b.exam!.at))
    .slice(0, 3)
  if (upcoming.length === 0) return null

  return (
    <>
      <div className="mx-1.5 mt-[26px] mb-2.5 flex items-baseline justify-between">
        <h2 className="text-xl font-bold tracking-[-0.4px]">{t('today.exams')}</h2>
        <Link to="/subjects" className="py-2.5 text-[15px] text-brand">
          {t('today.examsAll')}
        </Link>
      </div>
      <div className="flex gap-2.5">
        {upcoming.map(({ subject, exam }) => (
          <ExamTile key={subject.id} subject={subject} at={exam!.at} today={today} />
        ))}
      </div>
    </>
  )
}

function ExamTile({
  subject,
  at,
  today,
}: {
  subject: SubjectWithAssessments
  at: string
  today: LocalDate
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const boundary = useDayBoundary()
  const days = diffDays(today, localDay(new Date(at), { ...boundary, dayStartMin: 0 }))
  const { data: sources = [] } = useSources(subject.id)
  const palette = paletteOf(subject.color)
  const materials = sources.map(materialOf)
  const pct = materials.length ? Math.round(subjectMaterialProgress(materials) * 100) : null

  return (
    <Link
      to={`/subjects/${subject.id}`}
      className="glass flex min-w-0 flex-1 flex-col gap-2 rounded-card p-3.5"
    >
      <span className="flex flex-col gap-px">
        <span className={cn('text-xs font-bold uppercase', palette.deepText)}>
          {format(new Date(at), 'd MMM', { locale: dateFnsLocales[locale] })}
        </span>
        <span className="text-xs text-ink-secondary">
          {days <= 0
            ? t('today.examToday')
            : days === 1
              ? t('today.examTomorrow')
              : t('today.examIn', { count: days })}
        </span>
      </span>
      <span className="truncate text-sm font-semibold">{subject.name}</span>
      {pct !== null && (
        <>
          <span className="text-[22px] font-semibold tabular-nums">{pct}%</span>
          <span className="h-[5px] rounded-full bg-track">
            <span
              className={cn('block h-[5px] rounded-full', palette.bar)}
              style={{ width: `${pct}%` }}
            />
          </span>
        </>
      )}
    </Link>
  )
}

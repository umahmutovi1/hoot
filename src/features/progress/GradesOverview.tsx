import { Link } from 'react-router-dom'
import { EmptyCard } from '@/components/EmptyCard'
import { useTranslation } from 'react-i18next'
import { useLocale } from '@/features/settings/useLocale'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { formatPoints, pointsLabel } from '@/features/subjects/grades'
import type { Deadline, SubjectWithAssessments } from '@/features/subjects/model'
import { targetLine, useSubjectGrades } from '@/features/subjects/useSubjectGrades'
import { cn } from '@/lib/utils'

/** Napredak → "Ocjene": points, target and entry conditions per active subject (screen 6). */
export function GradesOverview() {
  const { t } = useTranslation()
  const { data: subjects = [] } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  const active = subjects.filter((s) => !s.archived)
  if (active.length === 0) return <EmptyCard>{t('progress.empty')}</EmptyCard>
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-lg font-semibold">{t('grades.overview.title')}</h2>
      <div className="flex flex-col rounded-card glass px-4 py-1.5">
        {active.map((s, i) => (
          <SubjectGrades
            key={s.id}
            subject={s}
            deadlines={deadlines}
            last={i === active.length - 1}
          />
        ))}
      </div>
    </section>
  )
}

function SubjectGrades({
  subject,
  deadlines,
  last,
}: {
  subject: SubjectWithAssessments
  deadlines: Deadline[]
  last: boolean
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const palette = paletteOf(subject.color)
  const { projection, titles, entries, hasPoints, pointsTotal } = useSubjectGrades(
    subject,
    deadlines,
  )
  const fmt = (n: number) => formatPoints(n, locale)
  const target = projection.grades.find((g) => g.grade === subject.target_grade)
  const pass = projection.grades[0]!
  const status = target ?? pass
  const entry = entries[0]

  const line = entry
    ? t('grades.overview.entry', {
        title: titles.get(entry.itemId) ?? '',
        points: pointsLabel(t, entry.missing, locale),
      })
    : status.kind === 'needs'
      ? t(target ? 'grades.overview.targetNeeds' : 'grades.overview.passNeeds', {
          grade: status.grade,
          points: fmt(status.points),
          remaining: fmt(projection.remaining),
          pct: Math.round(status.pct * 100),
        })
      : target
        ? targetLine(t, status, locale)
        : t(
            status.kind === 'secured'
              ? 'grades.overview.passSecured'
              : 'grades.overview.passUnreachable',
          )

  return (
    <Link
      to={`/subjects/${subject.id}`}
      className={cn('flex flex-col gap-1.5 py-3', !last && 'border-b border-hairline')}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('size-2.5 shrink-0 rounded-full', palette.bar)} />
          <span className="truncate text-[15px] font-semibold">{subject.name}</span>
        </span>
        <span className="shrink-0 text-[15px] font-bold">
          {hasPoints ? `${fmt(projection.have)}/${fmt(pointsTotal)}` : '—'}
        </span>
      </div>
      {hasPoints ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-track">
            <div
              className={cn('h-2', palette.bar)}
              style={{ width: `${Math.min(100, (projection.have / pointsTotal) * 100)}%` }}
            />
          </div>
          <span
            className={cn(
              'text-xs',
              entry || status.kind === 'unreachable' ? 'text-warning' : 'text-ink-muted',
            )}
          >
            {line}
          </span>
        </>
      ) : (
        <span className="text-xs text-ink-muted">
          {t('grades.overview.noPoints')} ·{' '}
          <span className="font-semibold text-brand">{t('grades.overview.addOnSubject')}</span>
        </span>
      )}
    </Link>
  )
}

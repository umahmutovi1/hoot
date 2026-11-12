import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChartIcon, ChevronRightIcon } from '@/components/icons'
import { useGlobalScale } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { formatPoints, gradeItemsOf, gradeSubjectOf } from '@/features/subjects/grades'
import { nextAssessment } from '@/features/subjects/model'
import { project } from '@/lib/grades'

/**
 * Napredak's way into Bodovi (board NapredakA, "Detaljnije"): the subject with the nearest exam,
 * its points so far and what its target still needs.
 */
export function PointsEntry() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: subjects = [] } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  const global = useGlobalScale()
  const [now] = useState(() => new Date())
  const active = subjects.filter((s) => !s.archived)
  if (active.length === 0) return null
  const fmt = (n: number) => formatPoints(n, locale)
  const withPoints = active
    .map((s) => ({
      subject: s,
      next: nextAssessment(s.assessments, now),
      projection: project(gradeItemsOf(s, deadlines), gradeSubjectOf(s, global)),
    }))
    .filter((r) => r.projection.slots.length > 0)
    // Subjects that already have points first, then by the nearest exam.
    .sort(
      (a, b) =>
        Number(b.projection.maxSoFar > 0) - Number(a.projection.maxSoFar > 0) ||
        (a.next?.at ?? '\uffff').localeCompare(b.next?.at ?? '\uffff'),
    )
  const first = withPoints[0]
  const status =
    first && first.projection.grades.find((g) => g.grade === (first.subject.target_grade ?? 6))
  const sub = !first
    ? t('points.rowEmpty')
    : [
        first.projection.maxSoFar > 0
          ? t('points.rowHave', {
              name: first.subject.name,
              have: fmt(first.projection.have),
              max: fmt(first.projection.maxSoFar),
            })
          : t('points.rowNone', { name: first.subject.name }),
        status?.kind === 'needs' &&
          t('points.rowNeeds', { grade: status.grade, points: fmt(Math.ceil(status.points)) }),
      ]
        .filter(Boolean)
        .join(' · ')
  return (
    <Link
      to="/progress/points"
      className="flex min-h-[72px] items-center gap-3.5 rounded-card surface py-3 pr-3 pl-3.5"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-subject-lavender-soft text-subject-lavender-ink">
        <ChartIcon size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-base">{t('points.title')}</b>
        <span className="text-[13px] text-ink-secondary tabular-nums">{sub}</span>
      </span>
      <ChevronRightIcon size={20} className="shrink-0 text-ink-secondary" />
    </Link>
  )
}

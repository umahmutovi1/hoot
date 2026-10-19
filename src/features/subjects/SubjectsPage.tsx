import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays } from 'date-fns'
import { EmptyCard } from '@/components/EmptyCard'
import { PlusIcon } from '@/components/icons'
import { PageTitle } from '@/components/PageTitle'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useSubjects } from './api'
import { paletteOf } from './colors'
import { examDateLabel, relativeDays } from './format'
import { nextAssessment, type SubjectWithAssessments } from './model'

/** Predmeti: active subjects with their next exam; archived ones behind a toggle. */
export function SubjectsPage() {
  const { t } = useTranslation()
  const { data: subjects = [], isPending } = useSubjects()
  const [showArchived, setShowArchived] = useState(false)
  const [now] = useState(() => new Date())
  const active = subjects.filter((s) => !s.archived)
  const archived = subjects.filter((s) => s.archived)

  return (
    <div className="flex flex-col">
      <PageTitle
        action={
          <Link
            to="/subjects/new"
            className="flex h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white"
          >
            <PlusIcon size={16} />
            {t('subjects.new')}
          </Link>
        }
      >
        {t('subjects.title')}
      </PageTitle>
      {!isPending && (
        <p className="mt-1.5 mb-4 text-sm text-ink-muted">
          {t('subjects.activeCount', { count: active.length })}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {!isPending && active.length === 0 && <EmptyCard>{t('subjects.empty')}</EmptyCard>}
        {active.map((s) => (
          <SubjectCard key={s.id} subject={s} now={now} />
        ))}
        {archived.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="h-[52px] rounded-full border border-dashed border-line text-sm font-medium text-ink-muted"
          >
            {t('subjects.archived', { count: archived.length })}
          </button>
        )}
        {showArchived && archived.map((s) => <SubjectCard key={s.id} subject={s} now={now} />)}
      </div>
    </div>
  )
}

function SubjectCard({ subject, now }: { subject: SubjectWithAssessments; now: Date }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const palette = paletteOf(subject.color)
  const next = nextAssessment(subject.assessments, now)

  return (
    <Link
      to={`/subjects/${subject.id}`}
      className={cn(
        'flex flex-col gap-3.5 rounded-card-lg bg-surface p-[18px]',
        subject.archived && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-[16px] text-lg font-bold',
            palette.soft,
            palette.deepText,
          )}
        >
          {subject.name.trim().charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 text-[17px] font-semibold">{subject.name}</span>
      </div>
      <div className="flex justify-between gap-3 text-[13px]">
        <span className="text-ink-muted">
          {next
            ? `${next.title} · ${examDateLabel(next, dateFnsLocales[locale])}`
            : t('subjects.noUpcomingExam')}
        </span>
        {next && (
          <span className={cn('font-semibold', palette.deepText)}>
            {relativeDays(t, differenceInCalendarDays(new Date(next.at), now))}
          </span>
        )}
      </div>
    </Link>
  )
}

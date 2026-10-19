import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays, format } from 'date-fns'
import { ChevronLeftIcon, FlagIcon, PencilIcon } from '@/components/icons'
import { SplashScreen } from '@/components/SplashScreen'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useSubject, useUpdateSubject } from './api'
import { paletteOf, type SubjectPalette } from './colors'
import { relativeDays } from './format'
import {
  asPriority,
  localDateOf,
  nextAssessment,
  type Assessment,
  type SubjectWithAssessments,
} from './model'

/**
 * Predmet / PredmetKampanja. Stage 2 shows the header, priority and mode chips, the campaign
 * card and exams; lectures, knowledge strength, sources and weak topics come with their stages.
 */
export function SubjectPage() {
  const { id } = useParams()
  const { data: subject, isPending } = useSubject(id)
  if (isPending) return <SplashScreen />
  if (!subject) return <Navigate to="/subjects" replace />
  return <SubjectDetail subject={subject} />
}

function SubjectDetail({ subject }: { subject: SubjectWithAssessments }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const [now] = useState(() => new Date())
  const palette = paletteOf(subject.color)
  const next = nextAssessment(subject.assessments, now)
  const exams = [...subject.assessments].sort((a, b) => a.at.localeCompare(b.at))
  const editPath = `/subjects/${subject.id}/edit`

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/subjects'))}
          aria-label={t('app.back')}
          className="flex size-11 items-center justify-center rounded-full bg-surface"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <Link
          to={editPath}
          aria-label={t('subjects.detail.edit')}
          className="flex size-11 items-center justify-center rounded-full bg-surface"
        >
          <PencilIcon size={18} />
        </Link>
      </div>

      <div className={cn('flex flex-col gap-2 rounded-[32px] p-5', palette.soft)}>
        <h1 className={cn('text-[23px] leading-[1.15] font-bold', palette.inkText)}>
          {subject.name}
        </h1>
        <div className="flex flex-wrap gap-1.5">
          <Link
            to={editPath}
            className={cn(
              'flex h-7 items-center rounded-full bg-surface px-2.5 text-xs font-semibold',
              palette.inkText,
            )}
          >
            {t('subjects.detail.priorityChip', {
              n: subject.priority,
              name: t(`subjects.priority.${asPriority(subject.priority)}.name`).toLowerCase(),
            })}
          </Link>
          <Link
            to={editPath}
            className={cn(
              'flex h-7 items-center rounded-full bg-surface px-2.5 text-xs font-semibold',
              palette.inkText,
            )}
          >
            {t(`subjects.mode.${subject.study_mode === 'campaign' ? 'campaign' : 'regular'}.title`)}
          </Link>
        </div>
        {next && (
          <span className={cn('text-[13px] leading-[1.35]', palette.inkText)}>
            {t('subjects.detail.nextExam', {
              title: next.title,
              when: relativeDays(t, differenceInCalendarDays(new Date(next.at), now)),
            })}
          </span>
        )}
      </div>

      {subject.study_mode === 'campaign' && <CampaignCard subject={subject} now={now} />}

      <div className="mt-1.5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('subjects.form.exams')}</h2>
        <Link
          to={editPath}
          className="flex h-9 items-center rounded-full bg-surface px-3 text-[13px] font-semibold text-brand"
        >
          {t('subjects.detail.addExam')}
        </Link>
      </div>
      {exams.length === 0 ? (
        <p className="rounded-card bg-surface p-4 text-sm text-ink-muted">
          {t('subjects.detail.noExams')}
        </p>
      ) : (
        <div className="flex flex-col rounded-card bg-surface p-1.5">
          {exams.map((exam, i) => (
            <div key={exam.id}>
              {i > 0 && <div className="mx-3 h-px bg-hairline" />}
              <ExamRow
                exam={exam}
                highlight={exam.id === next?.id}
                palette={palette}
                locale={locale}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExamRow({
  exam,
  highlight,
  palette,
  locale,
}: {
  exam: Assessment
  highlight: boolean
  palette: SubjectPalette
  locale: 'bs' | 'en'
}) {
  const { t } = useTranslation()
  const date = new Date(exam.at)
  const details = [
    t(exam.scope_all ? 'subjects.scope.all' : 'subjects.scope.part'),
    t(`subjects.format.${exam.format}`).toLowerCase(),
    exam.date_tentative && t('subjects.detail.tentative'),
    exam.contingent && t('subjects.detail.contingent'),
    exam.passed && t('subjects.detail.passed'),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex items-center gap-3 p-3">
      <div
        className={cn(
          'flex h-[54px] w-[50px] shrink-0 flex-col items-center justify-center rounded-[16px]',
          highlight ? palette.soft : 'bg-canvas',
        )}
      >
        <span className={cn('text-[19px] leading-none font-bold', highlight && palette.inkText)}>
          {exam.date_tentative ? '~' : ''}
          {format(date, 'd')}
        </span>
        <span className={cn('text-[11px]', highlight ? palette.deepText : 'text-ink-muted')}>
          {format(date, 'MMM', { locale: dateFnsLocales[locale] })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{exam.title}</span>
        <span className="text-xs text-ink-muted">{details}</span>
      </div>
    </div>
  )
}

function CampaignCard({ subject, now }: { subject: SubjectWithAssessments; now: Date }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const update = useUpdateSubject()
  const start = subject.campaign_start_on
  const startDate = start ? new Date(`${start}T12:00`) : null
  const startedAlready = startDate !== null && differenceInCalendarDays(startDate, now) <= 0

  return (
    <div className="flex flex-col gap-3 rounded-card bg-brand-soft p-[18px]">
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-surface text-brand">
          <FlagIcon />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-brand">{t('subjects.campaign.label')}</span>
          <span className="text-lg font-bold text-brand-strong">
            {startDate
              ? t('subjects.campaign.startsOn', {
                  date: format(startDate, 'd. MMM', { locale: dateFnsLocales[locale] }),
                  when: relativeDays(t, differenceInCalendarDays(startDate, now)),
                })
              : t('subjects.campaign.computedLater')}
          </span>
        </div>
      </div>
      <span className="text-[13px] leading-[1.45] text-avatar-ink">
        {t('subjects.campaign.body')}
      </span>
      <div className="flex gap-2">
        <Link
          to={`/subjects/${subject.id}/edit`}
          className="flex h-11 items-center rounded-full bg-surface px-[18px] text-sm font-semibold"
        >
          {t('subjects.campaign.move')}
        </Link>
        {!startedAlready && (
          <button
            type="button"
            onClick={() =>
              update.mutate({
                id: subject.id,
                patch: { campaign_start_on: localDateOf(now.toISOString()) },
              })
            }
            className="h-11 px-3.5 text-sm font-semibold text-brand"
          >
            {t('subjects.campaign.startNow')}
          </button>
        )}
      </div>
    </div>
  )
}

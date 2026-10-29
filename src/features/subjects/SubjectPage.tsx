import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { SessionsCard } from '@/features/session/SessionsCard'
import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays, format } from 'date-fns'
import { ArchiveIcon, ChevronRightIcon, FlagIcon, PencilIcon, TrashIcon } from '@/components/icons'
import { useToast } from '@/components/toast-store'
import { SwipeRow } from '@/components/SwipeRow'
import { SplashScreen } from '@/components/SplashScreen'
import { useLocale } from '@/features/settings/useLocale'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useScope, useSources } from '@/features/sources/api'
import {
  examProgress,
  materialOf,
  subjectMaterialProgress,
  toScopeRows,
} from '@/features/sources/model'
import { SubjectLectures } from '@/features/schedule/SubjectLectures'
import { ProgressRing, SubjectSources } from '@/features/sources/SubjectSources'
import {
  useArchiveExam,
  useArchivedExams,
  useDeadlines,
  useDeleteDeadline,
  useSubject,
  useUpdateSubject,
} from './api'
import { paletteOf, type SubjectPalette } from './colors'
import { DeadlineRow } from './DeadlineRow'
import { DeadlineSheet } from './DeadlineSheet'
import { ExamSheet } from './ExamSheet'
import { examDateLabel, relativeDays } from './format'
import { useGlobalScale } from '@/features/settings/profile'
import { gradeItemsOf, gradeSubjectOf, pointsDetails, pointsLabel, worthOf } from './grades'
import { ResultChip } from './ResultChip'
import { StrengthCard } from '@/features/review/StrengthCard'
import { GradesCard } from './GradesCard'
import { GoalCard } from './GoalCard'
import { SuggestionCard } from '@/features/plan/SuggestionCard'
import { useSuggestions } from '@/features/plan/useSuggestions'
import { usePlanStore } from '@/features/plan/store'
import { useRates } from '@/features/plan/api'
import { ResultSheet } from './ResultSheet'
import { ScaleSheet } from './ScaleSheet'
import { retakeStatus, type GradeItem } from '@/lib/grades'
import {
  asPriority,
  localDateOf,
  nextAssessment,
  shownExams,
  type Assessment,
  type SubjectWithAssessments,
} from './model'

/**
 * Predmet / PredmetKampanja: header with progress, priority and mode chips, the campaign card,
 * exams, sources and deadlines. Lectures, knowledge strength and weak topics come with their
 * stages.
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
  const globalScale = useGlobalScale()
  const { locale } = useLocale()
  const [now] = useState(() => new Date())
  const palette = paletteOf(subject.color)
  const next = nextAssessment(subject.assessments, now)
  // A makeup appears once its exam is failed; archived exams are not loaded (after 10b).
  const exams = shownExams(subject.assessments).sort((a, b) => a.at.localeCompare(b.at))
  const archiveExam = useArchiveExam(subject.id)
  const show = useToast((s) => s.show)
  const archiveRow = (exam: Assessment) => ({
    id: 'archive',
    label: t('swipe.archive'),
    tone: 'archive' as const,
    icon: <ArchiveIcon size={18} />,
    run: () => {
      archiveExam.mutate({ id: exam.id, archived: true })
      show(t('swipe.examArchived'), {
        label: t('today.cant.undo'),
        run: () => archiveExam.mutate({ id: exam.id, archived: false }),
      })
    },
  })
  const editPath = `/subjects/${subject.id}/edit`
  const { data: allDeadlines = [] } = useDeadlines()
  const deadlines = allDeadlines.filter((d) => d.subject_id === subject.id)
  const deleteDeadline = useDeleteDeadline()
  // Sheets keep only the id, so they always render the latest cached row.
  const [examSheet, setExamSheet] = useState<{ open: boolean; id?: string }>({ open: false })
  const { data: sources = [] } = useSources(subject.id)
  const rates = useRates()
  const materials = sources.map((s) => materialOf(s, rates.get(s.id)))
  const hasMaterial = materials.some((m) => m.units.length > 0)
  const { data: scope = [] } = useScope(subject.id)
  const scopeRows = toScopeRows(scope)
  const [deadlineSheet, setDeadlineSheet] = useState<{ open: boolean; id?: string }>({
    open: false,
  })
  const [scaleOpen, setScaleOpen] = useState(false)
  const [resultSheet, setResultSheet] = useState<{
    open: boolean
    kind?: 'exam' | 'deadline'
    id?: string
  }>({ open: false })
  const items = gradeItemsOf(subject, allDeadlines)
  const { pointsTotal } = gradeSubjectOf(subject, globalScale)
  const itemOf = (id: string) => items.find((i) => i.id === id)!
  const worth = (id: string) => worthOf(id, items, pointsTotal)
  const todayDate = localDateOf(now.toISOString())
  const suggestions = useSuggestions(subject.id).filter((s) => s.kind !== 'campaign_soon')
  const isDue = (iso: string) => localDateOf(iso) <= todayDate
  // Makeups are listed under the exam they repeat.
  const isNested = (a: Assessment) => a.kind === 'makeup' && exams.some((e) => e.id === a.retake_of)
  const hasPartials = exams.some((e) => e.kind === 'partial')
  const resultExam = subject.assessments.find((a) => a.id === resultSheet.id)
  const resultDeadline = deadlines.find((d) => d.id === resultSheet.id)
  const examRow = (exam: Assessment, nested = false) => (
    <ExamRow
      exam={exam}
      item={itemOf(exam.id)}
      worth={worth(exam.id)}
      due={isDue(exam.at)}
      nested={nested}
      replacesPartials={exam.kind === 'integral' && hasPartials}
      retakeNeeded={nested && retakeStatus(itemOf(exam.id), items) === 'needed'}
      highlight={exam.id === next?.id}
      progress={hasMaterial ? examProgress(exam, materials, scopeRows).fraction : undefined}
      palette={palette}
      locale={locale}
      onOpen={() => setExamSheet({ open: true, id: exam.id })}
      onResult={() => setResultSheet({ open: true, kind: 'exam', id: exam.id })}
    />
  )

  return (
    <div className="flex flex-col gap-3.5">
      <div
        className={cn('relative flex items-center gap-4 rounded-[32px] p-5 pr-16', palette.soft)}
      >
        <Link
          to={editPath}
          aria-label={t('subjects.detail.edit')}
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full glass"
        >
          <PencilIcon size={18} />
        </Link>
        {hasMaterial && (
          <ProgressRing
            fraction={subjectMaterialProgress(materials)}
            strokeClass={palette.stroke}
            textClass={palette.inkText}
          />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className={cn('text-[23px] leading-[1.15] font-bold', palette.inkText)}>
            {subject.name}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            <Link
              to={editPath}
              className={cn(
                'flex h-7 items-center rounded-full glass px-2.5 text-xs font-semibold',
                palette.inkText,
              )}
            >
              {[
                t(`subjects.priority.${asPriority(subject.priority)}.name`),
                subject.target_grade
                  ? t('subjects.goal.targetChip', { grade: subject.target_grade })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Link>
            <Link
              to={editPath}
              className={cn(
                'flex h-7 items-center rounded-full glass px-2.5 text-xs font-semibold',
                palette.inkText,
              )}
            >
              {t(
                `subjects.mode.${subject.study_mode === 'campaign' ? 'campaign' : 'regular'}.title`,
              )}
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
      </div>

      {subject.study_mode === 'campaign' && <CampaignCard subject={subject} now={now} />}

      {suggestions.map((s) => (
        <SuggestionCard key={s.key} suggestion={s} />
      ))}

      <GoalCard subject={subject} today={todayDate} />

      <GradesCard subject={subject} deadlines={deadlines} onScale={() => setScaleOpen(true)} />

      {hasMaterial && <SubjectLectures subject={subject} materials={materials} />}

      {hasMaterial && (
        <StrengthCard subjectId={subject.id} materials={materials} today={todayDate} />
      )}

      <SessionsCard subjectId={subject.id} />

      <div className="mt-1.5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('subjects.form.exams')}</h2>
        <button
          type="button"
          onClick={() => setExamSheet({ open: true })}
          className="flex h-9 items-center rounded-full glass px-3 text-[13px] font-semibold text-brand"
        >
          {t('subjects.detail.addExam')}
        </button>
      </div>
      {exams.length === 0 ? (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">
          {t('subjects.detail.noExams')}
        </p>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-card glass">
          {exams
            .filter((e) => !isNested(e))
            .map((exam, i) => (
              <div key={exam.id}>
                {i > 0 && <div className="mx-3 h-px bg-hairline" />}
                <SwipeRow actions={[archiveRow(exam)]}>
                  <div className="px-1.5">{examRow(exam)}</div>
                </SwipeRow>
                {exams
                  .filter((m) => m.kind === 'makeup' && m.retake_of === exam.id)
                  .map((m) => (
                    <SwipeRow key={m.id} actions={[archiveRow(m)]}>
                      <div className="px-1.5">{examRow(m, true)}</div>
                    </SwipeRow>
                  ))}
              </div>
            ))}
          {hasMaterial && (
            <>
              <div className="mx-3 h-px bg-hairline" />
              <Link
                to={`/subjects/${subject.id}/scope`}
                className="flex min-h-11 items-center justify-between px-3 py-2.5 text-sm font-semibold text-brand"
              >
                {t('scope.link')}
                <ChevronRightIcon size={16} />
              </Link>
            </>
          )}
        </div>
      )}

      <ArchivedExams subjectId={subject.id} />

      <SubjectSources subjectId={subject.id} materials={materials} />

      <div className="mt-1.5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('deadlines.section')}</h2>
        <button
          type="button"
          onClick={() => setDeadlineSheet({ open: true })}
          className="flex h-9 items-center rounded-full glass px-3 text-[13px] font-semibold text-brand"
        >
          {t('deadlines.add')}
        </button>
      </div>
      {deadlines.length === 0 ? (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">{t('deadlines.none')}</p>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-card glass">
          {deadlines.map((d, i) => (
            <div key={d.id}>
              {i > 0 && <div className="mx-3 h-px bg-hairline" />}
              <SwipeRow
                actions={[
                  {
                    id: 'delete',
                    label: t('swipe.delete'),
                    tone: 'danger',
                    icon: <TrashIcon size={18} />,
                    deferred: t('swipe.deadlineDeleted'),
                    run: () => deleteDeadline.mutateAsync(d.id),
                  },
                ]}
              >
                <div className="px-1.5">
                  <DeadlineRow
                    deadline={d}
                    now={now}
                    worth={worth(d.id)}
                    onOpen={() => setDeadlineSheet({ open: true, id: d.id })}
                    result={
                      <ResultChip
                        item={itemOf(d.id)}
                        worth={worth(d.id)}
                        due={d.done || isDue(d.due_at)}
                        onOpen={() => setResultSheet({ open: true, kind: 'deadline', id: d.id })}
                      />
                    }
                  />
                </div>
              </SwipeRow>
            </div>
          ))}
        </div>
      )}

      <ExamSheet
        subjectId={subject.id}
        exam={subject.assessments.find((a) => a.id === examSheet.id)}
        open={examSheet.open}
        onOpenChange={(open) => setExamSheet((s) => ({ ...s, open }))}
      />
      <ScaleSheet subject={subject} open={scaleOpen} onOpenChange={setScaleOpen} />
      <ResultSheet
        target={
          resultSheet.kind === 'exam' && resultExam
            ? { kind: 'exam', row: resultExam }
            : resultSheet.kind === 'deadline' && resultDeadline
              ? { kind: 'deadline', row: resultDeadline }
              : undefined
        }
        subjectName={subject.name}
        worth={resultSheet.id ? worth(resultSheet.id) : null}
        open={resultSheet.open}
        onOpenChange={(open) => setResultSheet((s) => ({ ...s, open }))}
      />
      <DeadlineSheet
        deadline={deadlines.find((d) => d.id === deadlineSheet.id)}
        subjectId={subject.id}
        open={deadlineSheet.open}
        onOpenChange={(open) => setDeadlineSheet((s) => ({ ...s, open }))}
      />
    </div>
  )
}

function ExamRow({
  exam,
  item,
  worth,
  due,
  nested,
  replacesPartials,
  retakeNeeded,
  highlight,
  progress,
  palette,
  locale,
  onOpen,
  onResult,
}: {
  exam: Assessment
  item: GradeItem
  /** Points the exam carries; null = no points. */
  worth: number | null
  /** The exam day has come: a result can be entered. */
  due: boolean
  /** A makeup under the exam it repeats. */
  nested: boolean
  replacesPartials: boolean
  /** The makeup is needed (its exam was failed or waived). */
  retakeNeeded: boolean
  highlight: boolean
  /** Progress over the exam's scope; undefined without sources. */
  progress?: number
  palette: SubjectPalette
  locale: 'bs' | 'en'
  onOpen: () => void
  onResult: () => void
}) {
  const { t } = useTranslation()
  const date = new Date(exam.at)
  const dfLocale = dateFnsLocales[locale]
  const points = pointsDetails(t, item, worth, locale)
  const details = [
    replacesPartials && t('grades.replacesPartials'),
    ...points,
    // Scope and format make room for the points once they are known.
    points.length === 0 && t(exam.scope_all ? 'subjects.scope.all' : 'subjects.scope.part'),
    points.length === 0 && t(`subjects.format.${exam.format}`).toLowerCase(),
    exam.entry_min_points !== null &&
      t('grades.entryShort', { points: pointsLabel(t, exam.entry_min_points, locale) }),
    nested && examDateLabel(exam, dfLocale),
    !nested &&
      exam.date_tentative &&
      (exam.at_latest
        ? t('subjects.detail.tentativeUntil', {
            date: format(new Date(exam.at_latest), 'd. MMM', { locale: dfLocale }),
          })
        : t('subjects.detail.tentative')),
    retakeNeeded
      ? t('grades.retakeNeeded')
      : exam.contingent && item.resultPoints === null && t('subjects.detail.contingent'),
  ]
    .filter(Boolean)
    .join(' · ')
  const chip = <ResultChip item={item} worth={worth} due={due} onOpen={onResult} />
  const hasChip = item.resultPoints !== null || due

  return (
    <div className={cn('flex w-full items-center gap-3 pr-3', nested ? 'pt-1 pb-3 pl-[30px]' : '')}>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 text-left',
          nested ? 'self-stretch' : 'py-3 pl-3',
        )}
      >
        {nested ? (
          <span aria-hidden="true" className="w-0.5 self-stretch rounded-full bg-line" />
        ) : (
          <div
            className={cn(
              'flex h-[54px] w-[50px] shrink-0 flex-col items-center justify-center rounded-[16px]',
              highlight ? palette.soft : 'bg-canvas',
            )}
          >
            <span
              className={cn('text-[19px] leading-none font-bold', highlight && palette.inkText)}
            >
              {exam.date_tentative ? '~' : ''}
              {format(date, 'd')}
            </span>
            <span className={cn('text-[11px]', highlight ? palette.deepText : 'text-ink-muted')}>
              {format(date, 'MMM', { locale: dfLocale })}
            </span>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('font-semibold', nested ? 'text-sm' : 'text-[15px]')}>
            {exam.title}
          </span>
          <span className={cn('text-xs', retakeNeeded ? 'text-warning' : 'text-ink-muted')}>
            {details}
          </span>
        </div>
      </button>
      {hasChip
        ? chip
        : progress !== undefined && (
            <span
              className={cn(
                'shrink-0 text-[15px] font-bold',
                highlight ? palette.inkText : 'text-ink-muted',
              )}
            >
              {Math.round(progress * 100)}%
            </span>
          )}
    </div>
  )
}

function CampaignCard({ subject, now }: { subject: SubjectWithAssessments; now: Date }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const update = useUpdateSubject()
  const model = usePlanStore((s) => s.model)
  const start = model?.result.campaignStarts[subject.id] ?? subject.campaign_start_on
  const work = model
    ? model.built.state.goals
        .filter((g) => g.subjectId === subject.id && g.kind === 'exam')
        .flatMap((g) => g.unitIds)
    : []
  const hours = Math.round(
    (model?.built.state.units ?? [])
      .filter((u) => work.includes(u.id) && u.level === 0)
      .reduce((sum, u) => sum + u.minutes, 0) / 60,
  )
  const startDate = start ? new Date(`${start}T12:00`) : null
  const startedAlready = startDate !== null && differenceInCalendarDays(startDate, now) <= 0

  return (
    <div className="flex flex-col gap-3 rounded-card bg-brand-soft p-[18px]">
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[16px] glass text-brand">
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
        {start && !subject.campaign_start_on && hours > 0
          ? t('subjects.campaign.computedBody', { hours })
          : t('subjects.campaign.body')}
      </span>
      <div className="flex gap-2">
        <Link
          to={`/subjects/${subject.id}/edit`}
          className="flex h-11 items-center rounded-full glass px-[18px] text-sm font-semibold"
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

/** "Arhivirani ispiti (N)": archived exams of the subject, to restore. */
function ArchivedExams({ subjectId }: { subjectId: string }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { data: archived = [] } = useArchivedExams(subjectId)
  const restore = useArchiveExam(subjectId)
  const show = useToast((s) => s.show)
  if (archived.length === 0) return null
  return (
    <details className="rounded-card glass px-4 py-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-ink-secondary">
        {t('swipe.archivedExams')} ({archived.length})
      </summary>
      <div className="flex flex-col pb-2">
        {archived.map((e) => (
          <div key={e.id} className="flex min-h-11 items-center justify-between gap-3">
            <span className="truncate text-[15px] text-ink-muted">
              {e.title} · {format(new Date(e.at), 'd. MMM', { locale: dateFnsLocales[locale] })}
            </span>
            <button
              type="button"
              onClick={() => {
                restore.mutate({ id: e.id, archived: false })
                show(t('swipe.examRestored'))
              }}
              className="flex h-9 shrink-0 items-center rounded-full bg-canvas px-3 text-[13px] font-semibold text-brand"
            >
              {t('swipe.restore')}
            </button>
          </div>
        ))}
      </div>
    </details>
  )
}

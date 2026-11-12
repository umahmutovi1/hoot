import { format } from 'date-fns'
import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BottomSheet } from '@/components/BottomSheet'
import { EmptyCard } from '@/components/EmptyCard'
import { PencilIcon, PlusIcon } from '@/components/icons'
import { ScreenTitle } from '@/components/ScreenTitle'
import { ListSkeleton } from '@/components/Skeleton'
import { useGlobalScale } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { useDeadlines, useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import {
  formatPoints,
  gradeItemsOf,
  gradeSubjectOf,
  scaleOf,
  worthOf,
} from '@/features/subjects/grades'
import {
  nextAssessment,
  shownExams,
  type Deadline,
  type SubjectWithAssessments,
} from '@/features/subjects/model'
import { ResultSheet, type ResultTarget } from '@/features/subjects/ResultSheet'
import { useSubjectGrades } from '@/features/subjects/useSubjectGrades'
import { dateFnsLocales, type Locale } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { pointsCard, type PointsCall } from './points'
import { ProgressProvider, useProgress } from './useProgress'

export function PointsPage() {
  return (
    <ProgressProvider>
      <Points />
    </ProgressProvider>
  )
}

/** Napredak → Bodovi (board Bodovi): points, forecast and target per subject. */
function Points() {
  const { t } = useTranslation()
  const { data: subjects = [], isPending } = useSubjects()
  const { data: deadlines = [] } = useDeadlines()
  const [picker, setPicker] = useState(false)
  const [result, setResult] = useState<{ open: boolean; target?: ResultTarget }>({ open: false })
  const active = subjects.filter((s) => !s.archived)
  const global = useGlobalScale()
  const resultSubject = active.find((s) => s.id === result.target?.row.subject_id)

  return (
    <div className="flex flex-col gap-3">
      <ScreenTitle title={t('points.title')} sub={t('points.sub', { count: active.length })} />
      {isPending ? (
        <ListSkeleton count={2} rows={4} />
      ) : active.length === 0 ? (
        <EmptyCard>{t('progress.empty')}</EmptyCard>
      ) : (
        <>
          {active.map((s) => (
            <SubjectPoints key={s.id} subject={s} deadlines={deadlines} />
          ))}
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="flex h-[52px] items-center justify-center gap-2 rounded-[18px] text-[15px] font-bold text-brand-strong shadow-[inset_0_0_0_1.5px_rgb(var(--hoot-brand-rgb)/0.35)]"
          >
            <PlusIcon size={18} />
            {t('points.enter')}
          </button>
          <p className="px-1 text-[13px] leading-[1.4] text-ink-muted">{t('points.enterHint')}</p>
          <p className="px-1 text-[13px] text-ink-muted tabular-nums">
            {t('points.defaultScale', {
              scale: scaleOf(global)
                .scale!.map((pct, i) => t('points.scaleStep', { grade: i + 6, pct }))
                .join(', '),
            })}
          </p>
        </>
      )}
      <ResultPicker
        open={picker}
        onOpenChange={setPicker}
        subjects={active}
        deadlines={deadlines}
        onPick={(target) => {
          setPicker(false)
          setResult({ open: true, target })
        }}
      />
      <ResultSheet
        target={result.target}
        subjectName={resultSubject?.name ?? ''}
        worth={
          result.target && resultSubject
            ? worthOf(
                result.target.row.id,
                gradeItemsOf(resultSubject, deadlines),
                gradeSubjectOf(resultSubject, global).pointsTotal,
              )
            : null
        }
        open={result.open}
        onOpenChange={(open) => setResult((r) => ({ ...r, open }))}
      />
    </div>
  )
}

function SubjectPoints({
  subject,
  deadlines,
}: {
  subject: SubjectWithAssessments
  deadlines: Deadline[]
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const data = useProgress()
  const global = useGlobalScale()
  const [now] = useState(() => new Date())
  const { projection, titles, hasPoints } = useSubjectGrades(subject, deadlines)
  const grading = gradeSubjectOf(subject, global)
  const palette = paletteOf(subject.color)
  const fmt = (n: number) => formatPoints(n, locale)
  const forecast = data?.forecasts.find(
    (f) => f.subject.id === subject.id && f.goal.unitIds.length > 0 && f.hasMemory,
  )
  const card = pointsCard(projection, grading, subject.target_grade, forecast?.score ?? null)
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / card.total) * 100))}%`
  const next = nextAssessment(subject.assessments, now)
  const meta = [
    subject.target_grade !== null && t('points.target', { grade: subject.target_grade }),
    next && `${next.title} ${dayLabel(next.at, locale)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const rangeLabel = card.range
    ? `${fmt(Math.floor(card.range.low))}–${fmt(Math.ceil(card.range.high))}`
    : null

  return (
    <article className="flex flex-col gap-3.5 rounded-card surface p-4">
      <div className="flex items-center gap-2.5">
        <span className={cn('size-3 shrink-0 rounded-full', palette.bar)} />
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-[17px] font-bold">{subject.name}</span>
          {meta && <span className="text-[13px] text-ink-secondary tabular-nums">{meta}</span>}
        </span>
        {hasPoints && (
          <span className="flex items-baseline gap-1">
            <span className="font-display text-[28px] leading-none font-bold tabular-nums">
              {fmt(card.have)}
            </span>
            <span className="text-[13px] text-ink-secondary tabular-nums">/ {fmt(card.total)}</span>
          </span>
        )}
        <Link
          to={`/progress/points/${subject.id}`}
          aria-label={t('points.edit', { name: subject.name })}
          className="-my-1.5 -mr-2 flex size-11 shrink-0 items-center justify-center text-brand-strong"
        >
          <PencilIcon size={20} />
        </Link>
      </div>

      {!hasPoints ? (
        <p className="text-sm leading-snug text-ink-secondary">{t('points.noItems')}</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={t('points.aria', {
              have: fmt(card.have),
              total: fmt(card.total),
              goal: card.goalGrade,
              points: fmt(card.goal),
            })}
            className="pb-5"
          >
            <div className="relative h-4 rounded-lg bg-track">
              {card.range && (
                <span
                  className={cn('absolute inset-y-0 rounded-lg opacity-40', palette.bar)}
                  style={{
                    left: pct(card.range.low),
                    width: `calc(${pct(card.range.high)} - ${pct(card.range.low)})`,
                  }}
                />
              )}
              <span
                className={cn('absolute inset-y-0 left-0 rounded-lg', palette.bar)}
                style={{ width: pct(card.have) }}
              />
              {card.ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute inset-y-0 w-[1.5px] bg-ground/90"
                  style={{ left: pct(tick) }}
                />
              ))}
              <span
                className="absolute -top-[5px] -ml-px h-[26px] w-[2.5px] rounded-sm bg-ink"
                style={{ left: pct(card.goal) }}
              />
            </div>
            <div aria-hidden="true" className="relative h-0">
              {card.ticks.map((tick, i) => {
                const end = card.ticks[i + 1] ?? card.total
                return (
                  <span
                    key={tick}
                    className="absolute top-1.5 -ml-3 w-6 text-center text-xs font-bold text-ink-secondary tabular-nums"
                    style={{ left: pct((tick + end) / 2) }}
                  >
                    {i + 6}
                  </span>
                )
              })}
            </div>
          </div>

          <div
            aria-hidden="true"
            className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-ink-secondary tabular-nums"
          >
            <span className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-3.5 rounded-[3px]', palette.bar)} />
              {t('points.legendEarned', { points: fmt(card.have) })}
            </span>
            {rangeLabel && (
              <span className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-3.5 rounded-[3px] opacity-40', palette.bar)} />
                {t('points.legendForecast', { range: rangeLabel })}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-[2.5px] rounded-sm bg-ink" />
              {t(subject.target_grade !== null ? 'points.legendTarget' : 'points.legendPass', {
                grade: card.goalGrade,
              })}
            </span>
          </div>

          <div className="flex flex-col">
            {projection.slots.map((slot) => {
              const open = slot.state !== 'counted'
              const title = titles.get(slot.itemId) ?? ''
              return (
                <div
                  key={slot.itemId}
                  className={cn(
                    'flex min-h-9 items-center justify-between gap-3 border-hairline text-[15px] not-first:border-t',
                    open && 'text-ink-secondary',
                  )}
                >
                  <span className="min-w-0 truncate">
                    {open ? `${title} · ${dayLabel(slot.at, locale)}` : title}
                  </span>
                  <b className="shrink-0 tabular-nums">
                    {open ? '–' : fmt(slot.earned)} / {fmt(slot.worth)}
                  </b>
                </div>
              )
            })}
          </div>

          <Callout
            call={card.call}
            name={subject.name}
            title={(id) => titles.get(id) ?? ''}
            rangeLabel={rangeLabel}
            rangeGrades={card.rangeGrades}
            pass={card.ticks[0]!}
            t={t}
            locale={locale}
          />
        </>
      )}
    </article>
  )
}

function Callout({
  call,
  name,
  title,
  rangeLabel,
  rangeGrades,
  pass,
  t,
  locale,
}: {
  call: PointsCall
  name: string
  title: (id: string) => string
  rangeLabel: string | null
  rangeGrades: number[]
  pass: number
  t: TFunction
  locale: Locale
}) {
  const fmt = (n: number) => formatPoints(n, locale)
  const grades =
    rangeGrades.length > 2
      ? t('points.gradesSpan', { low: rangeGrades[0], high: rangeGrades.at(-1) })
      : rangeGrades.join(` ${t('points.or')} `)
  const warn = call.kind === 'unreachable' || (call.kind === 'needs' && call.risk)
  const [head, body] =
    call.kind === 'none'
      ? [
          t('points.callNone'),
          call.first &&
            t('points.callNoneSub', {
              item: title(call.first.id),
              points: fmt(call.first.worth),
              grade: call.grade,
              need: fmt(call.need),
            }),
        ]
      : call.kind === 'secured'
        ? [t('grades.card.targetSecured', { grade: call.grade }), null]
        : call.kind === 'unreachable'
          ? [
              t('grades.card.targetUnreachable', { grade: call.grade }),
              t('grades.card.targetUnreachableSub', { max: fmt(call.max) }),
            ]
          : [
              t('points.callNeeds', {
                grade: call.grade,
                points: fmt(Math.ceil(call.points)),
                remaining: fmt(call.remaining),
              }),
              rangeLabel &&
                (call.risk
                  ? t('points.callRisk', { range: rangeLabel, pass: fmt(pass), name })
                  : t('points.callPace', { range: rangeLabel, grades })),
            ]
  return (
    <p
      className={cn(
        'rounded-2xl px-3.5 py-3 text-[15px] leading-[1.4]',
        warn ? 'bg-warning-soft text-warning-ink' : 'bg-raised text-ink',
      )}
    >
      <b>{head}</b>
      {body && ` ${body}`}
    </p>
  )
}

function dayLabel(iso: string, locale: Locale) {
  return format(new Date(iso), locale === 'en' ? 'MMM d' : 'd. MMM', {
    locale: dateFnsLocales[locale],
  })
}

/** "Upiši rezultat": the items that still wait for a result, nearest first. */
function ResultPicker({
  open,
  onOpenChange,
  subjects,
  deadlines,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjects: SubjectWithAssessments[]
  deadlines: Deadline[]
  onPick: (target: ResultTarget) => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const rows = subjects
    .flatMap((s) => [
      ...shownExams(s.assessments)
        .filter((a) => !a.archived_at && a.result_points === null && !a.result_annulled)
        .map((a) => ({ subject: s, at: a.at, target: { kind: 'exam', row: a } as ResultTarget })),
      ...deadlines
        .filter((d) => d.subject_id === s.id && d.points_max !== null && d.result_points === null)
        .map((d) => ({
          subject: s,
          at: d.due_at,
          target: { kind: 'deadline', row: d } as ResultTarget,
        })),
    ])
    .sort((a, b) => a.at.localeCompare(b.at))
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('points.enter')}
      subtitle={t('points.pickSub')}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-ink-secondary">{t('points.pickEmpty')}</p>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-card surface-raised">
          {rows.map(({ subject, at, target }) => (
            <button
              key={target.row.id}
              type="button"
              onClick={() => onPick(target)}
              className="flex min-h-14 items-center gap-3 border-hairline px-4 py-2 text-left not-first:border-t"
            >
              <span
                className={cn('size-2.5 shrink-0 rounded-full', paletteOf(subject.color).bar)}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-bold">{target.row.title}</span>
                <span className="truncate text-[13px] text-ink-secondary">
                  {subject.name} · {dayLabel(at, locale)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  )
}

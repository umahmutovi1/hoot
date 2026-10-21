import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useLocale } from '@/features/settings/useLocale'
import type { GradeStatus, Projection } from '@/lib/grades'
import { cn } from '@/lib/utils'
import { formatPoints, pointsLabel } from './grades'
import type { Deadline, SubjectWithAssessments } from './model'
import { targetLine, useSubjectGrades } from './useSubjectGrades'

/** "treba 9 (20%)" / "osigurano" / "nedostižno" for one grade row. */
function gradeLine(t: TFunction, status: GradeStatus, locale: string) {
  if (status.kind === 'secured') return t('grades.card.secured')
  if (status.kind === 'unreachable') return t('grades.card.unreachable')
  return t('grades.card.needs', {
    points: formatPoints(status.points, locale),
    pct: Math.round(status.pct * 100),
  })
}

/** Predmet → "Bodovi i ocjena" (BodoviOcjene mockup, screen 1). */
export function GradesCard({
  subject,
  deadlines,
  onScale,
}: {
  subject: SubjectWithAssessments
  deadlines: Deadline[]
  onScale: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { projection, titles, entries, hasPoints, pointsTotal } = useSubjectGrades(
    subject,
    deadlines,
  )
  const fmt = (n: number) => formatPoints(n, locale)
  const target = projection.grades.find((g) => g.grade === subject.target_grade)

  return (
    <div className="flex flex-col gap-3 rounded-card glass p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t('grades.card.title')}</h2>
        <button
          type="button"
          onClick={onScale}
          className="-mr-2 flex h-11 items-center px-2 text-[13px] font-semibold text-brand"
        >
          {t('grades.card.scale')}
        </button>
      </div>

      {!hasPoints ? (
        <p className="text-sm leading-snug text-ink-muted">{t('grades.card.empty')}</p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[30px] leading-none font-bold">
                {fmt(projection.have)}{' '}
                <span className="text-base font-medium text-ink-muted">/ {fmt(pointsTotal)}</span>
              </span>
              <span className="text-xs text-ink-muted">
                {projection.maxSoFar > 0
                  ? t('grades.card.haveOf', {
                      have: fmt(projection.have),
                      max: fmt(projection.maxSoFar),
                    })
                  : t('grades.card.nothingYet')}
              </span>
            </div>
            {subject.target_grade !== null && (
              <button
                type="button"
                onClick={onScale}
                className="flex h-8 items-center rounded-full bg-brand-soft px-2.5 text-xs font-semibold text-brand-strong"
              >
                {t('grades.card.targetChip', { grade: subject.target_grade })}
              </button>
            )}
          </div>

          <PointsBar projection={projection} titles={titles} fmt={fmt} />

          {target && (
            <TargetBox
              status={target}
              projection={projection}
              titles={titles}
              t={t}
              locale={locale}
            />
          )}

          <div className="flex flex-col">
            {projection.grades.map((g, i) => {
              const isTarget = g.grade === subject.target_grade
              return (
                <div
                  key={g.grade}
                  className={cn(
                    'flex items-center justify-between px-0.5 py-2',
                    i < projection.grades.length - 1 && 'border-b border-hairline',
                    isTarget && 'rounded-[10px] bg-canvas px-2',
                  )}
                >
                  <span className={cn('text-sm', isTarget ? 'font-bold' : 'font-semibold')}>
                    {isTarget ? t('grades.card.targetRow', { grade: g.grade }) : g.grade}
                  </span>
                  <span
                    className={cn(
                      'text-[13px]',
                      g.kind === 'secured' && 'font-semibold text-success',
                      g.kind === 'unreachable' && 'text-ink-subtle',
                      isTarget && g.kind === 'needs' && 'font-semibold',
                    )}
                  >
                    {gradeLine(t, g, locale)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {entries.map((e) => (
        <span key={e.itemId} className="text-xs leading-[1.4] text-warning">
          {t('grades.card.entryMissing', {
            title: titles.get(e.itemId) ?? '',
            points: pointsLabel(t, e.missing, locale),
          })}
        </span>
      ))}
    </div>
  )
}

function TargetBox({
  status,
  projection,
  titles,
  t,
  locale,
}: {
  status: GradeStatus
  projection: Projection
  titles: Map<string, string>
  t: TFunction
  locale: string
}) {
  const left = projection.remainingSlots.map((s) => titles.get(s.itemId) ?? '').filter(Boolean)
  const sub =
    status.kind === 'needs'
      ? t('grades.card.targetNeedsSub', {
          remaining: formatPoints(projection.remaining, locale),
          pct: Math.round(status.pct * 100),
          items: new Intl.ListFormat(locale, { type: 'conjunction' }).format(left),
        })
      : status.kind === 'unreachable'
        ? t('grades.card.targetUnreachableSub', {
            max: formatPoints(projection.maxPossible, locale),
          })
        : null
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-[18px] px-3.5 py-3',
        status.kind === 'unreachable' ? 'bg-warning-soft' : 'bg-brand-soft',
      )}
    >
      <span
        className={cn(
          'text-[15px] font-semibold',
          status.kind === 'unreachable' ? 'text-warning-ink' : 'text-brand-strong',
        )}
      >
        {targetLine(t, status, locale)}
      </span>
      {sub && (
        <span
          className={cn(
            'text-[13px]',
            status.kind === 'unreachable' ? 'text-warning' : 'text-brand',
          )}
        >
          {sub}
        </span>
      )}
    </div>
  )
}

/** One segment per slot, width = its points; green = earned, hatched = still to win. */
function PointsBar({
  projection,
  titles,
  fmt,
}: {
  projection: Projection
  titles: Map<string, string>
  fmt: (n: number) => string
}) {
  const { slots } = projection
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-[7px]">
        {slots.map((s) => (
          <div
            key={s.itemId}
            className={cn(
              'relative overflow-hidden',
              s.state === 'counted'
                ? 'bg-track'
                : 'bg-[repeating-linear-gradient(135deg,var(--color-hairline)_0_6px,var(--color-canvas-soft)_6px_12px)]',
            )}
            style={{ flex: s.worth }}
          >
            {s.state === 'counted' && (
              <div
                className="absolute inset-y-0 left-0 bg-score"
                style={{ width: `${(s.earned / s.worth) * 100}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] text-[11px] text-ink-muted">
        {slots.map((s) => (
          <span key={s.itemId} className="min-w-0 truncate" style={{ flex: s.worth }}>
            {titles.get(s.itemId)}{' '}
            {s.state === 'counted' ? `${fmt(s.earned)}/${fmt(s.worth)}` : `· ${fmt(s.worth)}`}
          </span>
        ))}
      </div>
    </div>
  )
}

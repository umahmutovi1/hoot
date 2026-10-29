import { format } from 'date-fns'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScreenTitle } from '@/components/ScreenTitle'
import { Button } from '@/components/ui/button'
import { useWeekdayNames } from '@/features/schedule/weekdays'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import type { ExamProposal, LectureProposal } from '@/lib/calendar/match'
import { dateFnsLocales } from '@/lib/locale'
import { formatClock } from '@/lib/schedule'
import { cn } from '@/lib/utils'
import { useCalendarFeeds } from './api'
import {
  actionsFor,
  NoTeachingPeriod,
  useAnswerSeries,
  useApplyCalendarProposals,
  useCalendarProposals,
  type MatchAction,
} from './matches'

const TAG: Record<'new' | 'same' | 'changed', string> = {
  new: 'text-success',
  same: 'text-brand',
  changed: 'text-brand',
}

/**
 * Iz kalendara (docs/CALENDAR-SYNC.md "Duplikati"): lecture series and exams found in connected
 * calendars. New ones go into Hoot linked; ones Hoot already has are offered as Spoji (default),
 * Google zamjenjuje, Hoot zamjenjuje (Google only) or Zadrži oba. Nothing is saved before "Primijeni".
 */
export function CalendarImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // Onboarding sends `back`, so applying returns to its step.
  const back = (useLocation().state as { back?: string } | null)?.back ?? '/'
  const { locale } = useLocale()
  const weekdays = useWeekdayNames('short')
  const { lectures, exams, unknown } = useCalendarProposals()
  const answer = useAnswerSeries()
  const subjects = (useSubjects().data ?? []).filter((s) => !s.archived)
  const feeds = useCalendarFeeds().data ?? []
  const apply = useApplyCalendarProposals()
  const [actionOf, setActionOf] = useState<Record<string, MatchAction>>({})
  const [subjectOf, setSubjectOf] = useState<Record<string, string | null>>({})
  const isGoogle = (feedId: string) => feeds.find((f) => f.id === feedId)?.source === 'google'
  const sourceOf = (feedId: string) => feeds.find((f) => f.id === feedId)?.title ?? ''

  const action = (p: LectureProposal | ExamProposal) =>
    actionOf[p.key] ?? actionsFor(p.status, isGoogle(p.feedId))[0]!
  const subject = (p: LectureProposal | ExamProposal) =>
    p.key in subjectOf ? subjectOf[p.key]! : p.subjectId
  const when = (iso: string) =>
    format(new Date(iso), 'EEE d. MMM, HH:mm', { locale: dateFnsLocales[locale] })
  const total = lectures.length + exams.length

  const row = (p: LectureProposal | ExamProposal, line: string, previous: string | null) => {
    const current = action(p)
    const needsSubject = current === 'add'
    return (
      <div
        key={p.key}
        className="flex flex-col gap-2 border-b border-canvas px-2.5 py-3 last:border-0"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cn('text-[10px] font-bold uppercase', TAG[p.status])}>
            {t(`calendarImport.tag.${p.status}`)}
          </span>
          <span className="text-sm leading-[1.3] font-semibold">{p.title}</span>
          <span className="text-xs text-ink-muted">
            {previous && (
              <>
                <s>{previous}</s>
                {' → '}
              </>
            )}
            {line} · {t('feeds.fromSource', { source: sourceOf(p.feedId) })}
          </span>
        </span>
        <div role="radiogroup" aria-label={p.title} className="flex flex-wrap gap-1.5">
          {actionsFor(p.status, isGoogle(p.feedId)).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={current === a}
              onClick={() => setActionOf((x) => ({ ...x, [p.key]: a }))}
              className={cn(
                'h-11 rounded-full px-3.5 text-[13px] font-semibold',
                current === a ? 'bg-ink text-white' : 'bg-white/50 text-ink',
              )}
            >
              {t(`calendarImport.action.${a}`)}
            </button>
          ))}
        </div>
        <span className="text-xs leading-[1.4] text-ink-muted">
          {t(`calendarImport.actionHint.${current}`)}
        </span>
        {needsSubject && (
          <select
            aria-label={t('moodle.subject', { title: p.title })}
            value={subject(p) ?? ''}
            onChange={(e) => setSubjectOf((x) => ({ ...x, [p.key]: e.target.value || null }))}
            className="h-11 min-w-0 rounded-input bg-canvas px-3 text-sm outline-none"
          >
            <option value="">{t('moodle.noSubject')}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5 pb-6">
      <ScreenTitle title={t('calendarImport.title')} />
      <span className="text-[13px] text-ink-muted">{t('calendarImport.lead')}</span>

      {unknown.length > 0 && (
        <>
          <span className="px-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {t('calendarImport.unknown')}
          </span>
          <div className="flex flex-col rounded-card glass p-1.5">
            {unknown.map((u) => (
              <div
                key={u.key}
                className="flex flex-col gap-2 border-b border-canvas px-2.5 py-3 last:border-0"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm leading-[1.3] font-semibold">{u.title}</span>
                  <span className="text-xs text-ink-muted">
                    {t('calendarImport.weekly', {
                      day: weekdays[u.weekday],
                      from: formatClock(u.startMin),
                      to: formatClock(u.endMin),
                    })}
                  </span>
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={answer.isPending}
                    onClick={() => answer.mutate({ series: u, lecture: true })}
                    className="h-11 flex-1 rounded-full bg-white/50 text-[13px] font-semibold text-brand"
                  >
                    {t('calendarImport.isLecture')}
                  </button>
                  <button
                    type="button"
                    disabled={answer.isPending}
                    onClick={() => answer.mutate({ series: u, lecture: false })}
                    className="h-11 flex-1 rounded-full bg-white/50 text-[13px] font-semibold"
                  >
                    {t('calendarImport.notLecture')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {total === 0 && unknown.length === 0 && (
        <p className="rounded-card glass p-4 text-sm text-ink-muted">{t('calendarImport.none')}</p>
      )}
      {lectures.length > 0 && (
        <>
          <span className="px-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {t('calendarImport.lectures')}
          </span>
          <div className="flex flex-col rounded-card glass p-1.5">
            {lectures.map((p) =>
              row(
                p,
                t('calendarImport.weekly', {
                  day: weekdays[p.weekday],
                  from: formatClock(p.startMin),
                  to: formatClock(p.endMin),
                }),
                null,
              ),
            )}
          </div>
        </>
      )}
      {exams.length > 0 && (
        <>
          <span className="px-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {t('calendarImport.exams')}
          </span>
          <div className="flex flex-col rounded-card glass p-1.5">
            {exams.map((p) =>
              row(
                p,
                when(p.startsAt),
                p.status === 'changed' && p.previousAt ? when(p.previousAt) : null,
              ),
            )}
          </div>
        </>
      )}

      {total > 0 && (
        <Button
          type="button"
          size="pill"
          disabled={apply.isPending}
          className="mt-1 btn-primary"
          onClick={async () => {
            await apply.mutateAsync({
              lectures: lectures.map((p) => ({
                proposal: p,
                action: action(p),
                subjectId: subject(p),
              })),
              exams: exams.map((p) => ({ proposal: p, action: action(p), subjectId: subject(p) })),
            })
            navigate(back, { replace: true })
          }}
        >
          {t('calendarImport.apply', { count: total })}
        </Button>
      )}
      {apply.isError && (
        <p className="text-sm text-danger">
          {apply.error instanceof NoTeachingPeriod
            ? t('calendarImport.noTeaching')
            : t('owl.error.failed')}
        </p>
      )}
    </div>
  )
}

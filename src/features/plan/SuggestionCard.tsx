import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { CalendarIcon, ChartIcon, FlagIcon, SparkleIcon, WarningIcon } from '@/components/icons'
import { formatDuration } from '@/features/sources/format'
import { useLocale } from '@/features/settings/useLocale'
import { useSetEveReserved, useSubjects } from '@/features/subjects/api'
import { useToast } from '@/components/toast-store'
import { asPriority } from '@/features/subjects/model'
import { addDays, toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import type { BehindAction, Suggestion } from '@/lib/scheduler'
import { cn } from '@/lib/utils'
import { useStartCheck } from '@/features/review/useStartCheck'
import { usePatchSubject, useRaiseCaps } from './actions'
import { useGoalTitle } from './model'
import { ReplanSheet } from './ReplanSheet'
import { usePlanStore } from './store'
import { SNOOZE_DAYS, usePlanUi } from './ui'

function Card({
  icon,
  tone = 'neutral',
  title,
  sub,
  children,
}: {
  icon: ReactNode
  tone?: 'neutral' | 'warning'
  title: string
  sub?: string | null
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-card p-4',
        tone === 'warning' ? 'bg-warning-soft' : 'glass',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-[38px] shrink-0 items-center justify-center rounded-[12px]',
            tone === 'warning' ? 'bg-white/60 text-warning' : 'icon-tile',
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn('text-[15px] font-semibold', tone === 'warning' && 'text-warning-ink')}
          >
            {title}
          </span>
          {sub && (
            <span
              className={cn(
                'text-[13px] leading-[1.35]',
                tone === 'warning' ? 'text-warning-muted' : 'text-ink-muted',
              )}
            >
              {sub}
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

/** "utorak, 27. okt" at the start of a sentence. */
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const primary =
  'btn-primary flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-semibold'
const secondary =
  'flex min-h-10 items-center rounded-full bg-canvas px-4 py-2 text-sm font-semibold text-brand'
const later = 'flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-ink-secondary'

/** One suggestion: what changed or is at risk, and the one-tap changes of input. */
export function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const { data: subjects = [] } = useSubjects()
  const model = usePlanStore((s) => s.model)
  const snooze = usePlanUi((s) => s.snooze)
  const patch = usePatchSubject()
  const caps = useRaiseCaps()
  const startCheck = useStartCheck()
  const setEve = useSetEveReserved()
  const toast = useToast((s) => s.show)
  const [raiseCap, setRaiseCap] = useState(true)
  const [replanOpen, setReplanOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const today = model?.built.today ?? ''
  const name = (id: string) => subjects.find((s) => s.id === id)?.name ?? ''
  const levelName = (p: number) => t(`subjects.priority.${asPriority(p)}.name`)
  const date = (d: string) => format(toDisplayDate(d), 'd. MMM', { locale: dateFnsLocales[locale] })
  const goalTitleOf = useGoalTitle()
  const goalTitle = (id: string) => goalTitleOf(id) ?? ''
  const laterButton = (
    <button
      type="button"
      className={later}
      onClick={() => snooze(suggestion.key, addDays(today, SNOOZE_DAYS - 1))}
    >
      {t('suggestions.later')}
    </button>
  )

  if (done)
    return (
      <div className="rounded-[20px] bg-success-soft px-4 py-3.5 text-sm text-success-ink">
        {done}
      </div>
    )

  switch (suggestion.kind) {
    case 'fresh_start':
      return (
        <Card
          icon={<SparkleIcon size={18} />}
          title={t('suggestions.fresh.title')}
          sub={t('suggestions.fresh.sub')}
        >
          <button type="button" className={primary} onClick={() => navigate('/today/fresh')}>
            {t('suggestions.fresh.open')}
          </button>
        </Card>
      )
    case 'deficit':
      return (
        <Card
          tone="warning"
          icon={<WarningIcon size={20} />}
          title={t('suggestions.deficit.title', {
            goal: goalTitle(suggestion.goalId),
            subject: name(suggestion.subjectId),
            time: formatDuration(t, suggestion.minutes),
          })}
          sub={t('suggestions.deficit.sub', { date: date(suggestion.until) })}
        >
          <button type="button" className={primary} onClick={() => setReplanOpen(true)}>
            {t('suggestions.deficit.solve')}
          </button>
          {laterButton}
          <ReplanSheet open={replanOpen} onOpenChange={setReplanOpen} goalId={suggestion.goalId} />
        </Card>
      )
    case 'behind':
      return (
        <Card
          tone="warning"
          icon={<FlagIcon size={18} />}
          title={t('suggestions.behind.title', {
            subject: name(suggestion.subjectId),
            time: formatDuration(t, suggestion.behindMinutes),
          })}
          sub={t('suggestions.behind.sub')}
        >
          {suggestion.actions.map((a, i) => (
            <button
              key={a.kind}
              type="button"
              className={i === 0 ? primary : secondary}
              onClick={() => {
                applyBehind(a, suggestion.subjectId)
              }}
            >
              {behindLabel(a)}
            </button>
          ))}
          {laterButton}
        </Card>
      )
    case 'target_grade':
      return (
        <Card
          icon={<ChartIcon size={18} />}
          title={t('suggestions.grade.title', { subject: name(suggestion.subjectId) })}
          sub={t('suggestions.grade.sub', { level: levelName(suggestion.priority) })}
        >
          <button
            type="button"
            className={primary}
            onClick={() => {
              patch.mutate({ id: suggestion.subjectId, patch: { priority: suggestion.priority } })
              setDone(t('suggestions.grade.done', { level: levelName(suggestion.priority) }))
            }}
          >
            {t('suggestions.change')}
          </button>
          {laterButton}
        </Card>
      )
    case 'exam_period':
      return (
        <Card
          icon={<CalendarIcon size={18} />}
          title={t('suggestions.period.title', {
            hours: suggestion.capMin / 60,
            date: date(suggestion.until),
          })}
        >
          <button
            type="button"
            className={primary}
            onClick={() => {
              caps.mutate({
                from: today,
                until: suggestion.until,
                cap: (c) => Math.max(c, suggestion.capMin),
              })
              setDone(t('suggestions.period.done', { hours: suggestion.capMin / 60 }))
            }}
          >
            {t('suggestions.period.raise')}
          </button>
          {laterButton}
        </Card>
      )
    case 'exam_eve': {
      const day = format(toDisplayDate(suggestion.day), 'EEEE, d. MMM', {
        locale: dateFnsLocales[locale],
      })
      const reserve = () => {
        const previous = model?.built.state.days.find((d) => d.date === suggestion.day)?.cap
        const raise = raiseCap && suggestion.capMin !== null
        setEve.mutate({ id: suggestion.goalId, value: true })
        if (raise)
          caps.mutate({
            from: suggestion.day,
            until: suggestion.day,
            cap: (c) => Math.max(c, suggestion.capMin!),
          })
        toast(
          t('suggestions.eve.done', { day: upperFirst(day), subject: name(suggestion.subjectId) }),
          {
            label: t('today.cant.undo'),
            run: () => {
              setEve.mutate({ id: suggestion.goalId, value: null })
              if (raise && previous !== undefined)
                caps.mutate({ from: suggestion.day, until: suggestion.day, cap: () => previous })
            },
          },
        )
      }
      return (
        <Card
          icon={<CalendarIcon size={18} />}
          title={
            suggestion.takenBy
              ? t('suggestions.eve.takenTitle', {
                  taken: upperFirst(
                    format(toDisplayDate(suggestion.takenBy.day), 'EEEE, d. MMM', {
                      locale: dateFnsLocales[locale],
                    }),
                  ),
                  other: name(suggestion.takenBy.subjectId),
                  day,
                  subject: name(suggestion.subjectId),
                })
              : t('suggestions.eve.title', { day, subject: name(suggestion.subjectId) })
          }
          sub={t(suggestion.takenBy ? 'suggestions.eve.takenSub' : 'suggestions.eve.sub')}
        >
          {suggestion.capMin !== null && (
            <label className="flex min-h-11 w-full items-center gap-3 rounded-[16px] bg-white/50 px-3.5 py-2 text-sm">
              <input
                type="checkbox"
                checked={raiseCap}
                onChange={(e) => setRaiseCap(e.target.checked)}
                className="size-5 accent-brand"
              />
              <span className="flex-1">
                {t('suggestions.eve.raiseCap', { time: formatDuration(t, suggestion.capMin) })}
              </span>
            </label>
          )}
          <button type="button" className={cn(primary, 'flex-1 justify-center')} onClick={reserve}>
            {t(suggestion.takenBy ? 'suggestions.eve.reserveDay' : 'suggestions.eve.reserve', {
              day: format(toDisplayDate(suggestion.day), 'EEEE', {
                locale: dateFnsLocales[locale],
              }),
            })}
          </button>
          <button
            type="button"
            className={secondary}
            onClick={() => setEve.mutate({ id: suggestion.goalId, value: false })}
          >
            {t('suggestions.eve.no')}
          </button>
        </Card>
      )
    }
    case 'check': {
      // One subject per check session: the one with the most checks waiting.
      const subjectOf = new Map(model?.built.state.units.map((u) => [u.id, u.subjectId]) ?? [])
      const counts = new Map<string, number>()
      for (const id of suggestion.unitIds) {
        const sid = subjectOf.get(id)
        if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1)
      }
      const subjectId = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0]
      return (
        <Card
          icon={<ChartIcon size={18} />}
          title={t('review.card.title')}
          sub={t('review.card.sub', {
            count: suggestion.unitIds.length,
            min: Math.round(suggestion.minutes),
          })}
        >
          {subjectId && (
            <button
              type="button"
              className={primary}
              onClick={() => {
                const ids = suggestion.unitIds.filter((id) => subjectOf.get(id) === subjectId)
                const share = suggestion.minutes * (ids.length / suggestion.unitIds.length)
                void startCheck(subjectId, ids, share)
              }}
            >
              {t('review.card.start')}
            </button>
          )}
          {laterButton}
        </Card>
      )
    }
    case 'campaign_soon':
      return (
        <Card
          icon={<CalendarIcon size={18} />}
          title={t('suggestions.campaign.title', {
            subject: name(suggestion.subjectId),
            date: date(suggestion.start),
          })}
          sub={t('suggestions.campaign.sub', { count: suggestion.days })}
        >
          <button
            type="button"
            className={secondary}
            onClick={() => {
              patch.mutate({
                id: suggestion.subjectId,
                patch: { campaign_start_on: today },
              })
              setDone(t('suggestions.campaign.done'))
            }}
          >
            {t('suggestions.campaign.now')}
          </button>
          <button
            type="button"
            className={later}
            onClick={() => snooze(suggestion.key, suggestion.start)}
          >
            {t('suggestions.ok')}
          </button>
        </Card>
      )
  }

  function behindLabel(a: BehindAction): string {
    switch (a.kind) {
      case 'raise_priority':
        return t('suggestions.behind.raise', { level: levelName(a.priority) })
      case 'switch_to_regular':
        return t('suggestions.behind.regular')
      case 'take_time_from':
        return t('suggestions.behind.take', { minutes: a.minutesPerDay, subject: name(a.donorId) })
      case 'start_earlier':
        return t('suggestions.behind.earlier', { date: date(a.start) })
      case 'add_minutes':
        return t('suggestions.behind.add', { minutes: a.minutesPerDay })
    }
  }

  function applyBehind(a: BehindAction, subjectId: string) {
    switch (a.kind) {
      case 'raise_priority':
        patch.mutate({ id: subjectId, patch: { priority: a.priority } })
        setDone(t('suggestions.behind.doneRaise', { level: levelName(a.priority) }))
        break
      case 'switch_to_regular':
        patch.mutate({ id: subjectId, patch: { study_mode: 'regular', campaign_start_on: null } })
        setDone(t('suggestions.behind.doneRegular'))
        break
      case 'take_time_from':
        patch.mutate({ id: subjectId, patch: { priority_boost_until: a.until } })
        setDone(
          t('suggestions.behind.doneTake', {
            subject: name(subjectId),
            minutes: a.minutesPerDay,
            donor: name(a.donorId),
            date: date(a.until),
          }),
        )
        break
      case 'start_earlier':
        patch.mutate({ id: subjectId, patch: { campaign_start_on: a.start } })
        setDone(t('suggestions.behind.doneEarlier', { date: date(a.start) }))
        break
      case 'add_minutes':
        caps.mutate({ from: addDays(today, 1), until: a.until, cap: (c) => c + a.minutesPerDay })
        setDone(t('suggestions.behind.doneAdd', { minutes: a.minutesPerDay, date: date(a.until) }))
        break
    }
  }
}

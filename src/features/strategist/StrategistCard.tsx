import { acceptedThisWeek } from './feedbackInputs'
import { useFeedback } from './feedback'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/auth-context'
import { useAiAvailability } from '@/features/owl/api'
import { useProgress } from '@/features/progress/useProgress'
import { usePlanStore } from '@/features/plan/store'
import { diffDays, localDay, weekdayOf } from '@/lib/day'
import { useStrategist } from './useStrategist'
import { useApplyAction } from './useApplyAction'
import { useRecordFeedback } from './feedback'
import { actionLabel } from './copy'
import { useToast } from '@/components/toast-store'

export function StrategistCard({
  compact = false,
  maxActions = 3,
  inReview = false,
}: {
  compact?: boolean
  maxActions?: number
  inReview?: boolean
}) {
  const { t } = useTranslation()
  const data = useProgress(),
    strategy = useStrategist(),
    apply = useApplyAction(),
    record = useRecordFeedback()
  const userId = useAuth().session?.user.id
  const availability = useAiAvailability()
  const attempted = useRef('')
  // Applied in this visit: a failed feedback write must not offer the same action a second time.
  const [applied, setApplied] = useState<ReadonlySet<string>>(new Set())
  const feedback = useFeedback().data ?? []
  const remaining = Math.max(0, 3 - acceptedThisWeek(feedback, strategy.week))
  const replan = usePlanStore((s) => s.replanNow)
  const { mutate: generate } = strategy.generate
  useEffect(() => {
    if (
      !data ||
      weekdayOf(data.today) !== 6 ||
      !strategy.list.length ||
      !strategy.canGenerate ||
      strategy.cached ||
      availability.state !== 'ready'
    )
      return
    const key = `hoot-strategist:${userId}:${strategy.week}`
    if (attempted.current === key || localStorage.getItem(key)) return
    attempted.current = key
    localStorage.setItem(key, '1')
    generate()
  }, [
    data,
    strategy.list,
    strategy.canGenerate,
    strategy.cached,
    strategy.week,
    availability.state,
    userId,
    generate,
  ])
  if (!data) return null
  if (
    compact &&
    (!strategy.output ||
      !strategy.cached ||
      diffDays(
        localDay(new Date(strategy.cached.created_at), {
          timeZone: data.inputs.profile.timezone,
          dayStartMin: data.inputs.profile.day_start_min,
        }),
        data.today,
      ) > 3)
  )
    return (
      <Link
        to="/progress/week"
        className="glass flex min-h-11 items-center justify-between rounded-card p-4 text-sm text-brand"
      >
        <span>{t('checkin.title')}</span>
        <span>›</span>
      </Link>
    )
  return (
    <section className="glass flex flex-col gap-3 rounded-card p-4">
      {!inReview && <h2 className="text-base font-semibold">{t('strategist.title')}</h2>}
      {!inReview && (
        <p className="text-sm text-ink-secondary">
          {strategy.output?.summary ?? t('strategist.fallback')}
        </p>
      )}
      {strategy.output?.risks.map((risk, i) => (
        <p key={i} className="text-xs text-warning">
          {risk}
        </p>
      ))}
      {!compact && (
        <>
          {strategy.selected
            .filter((c) => !applied.has(c.id))
            .slice(0, Math.min(maxActions, remaining))
            .map((c) => (
              <article key={c.id} className="flex flex-col gap-2 rounded-[18px] bg-white/40 p-3">
                <p className="text-sm font-semibold">
                  {actionLabel(
                    t,
                    c.action,
                    'subjectId' in c.action
                      ? data.inputs.subjects.find(
                          (s) => s.id === ('subjectId' in c.action ? c.action.subjectId : null),
                        )?.name
                      : '',
                  )}
                </p>
                {c.reason && <p className="text-xs text-ink-secondary">{c.reason}</p>}
                {c.effect && (
                  <p className="text-xs text-ink-muted">
                    {t('strategist.effect', {
                      before: c.effect.deficitBefore,
                      after: c.effect.deficitAfter,
                    })}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary min-h-11 flex-1 rounded-full px-3 text-sm"
                    disabled={apply.isPending || record.isPending}
                    onClick={() =>
                      void (async () => {
                        await apply.mutateAsync(c.action)
                        setApplied((prev) => new Set(prev).add(c.id))
                        useToast.getState().success(t('strategist.done'))
                        await record.mutateAsync({
                          candidateId: c.id,
                          status: 'accepted',
                          payload: { action: c.action, effect: c.effect, week: strategy.week },
                        })
                        replan()
                      })().catch(() => {})
                    }
                  >
                    {t('strategist.apply')}
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-full px-3 text-sm text-brand"
                    disabled={record.isPending}
                    onClick={() =>
                      record.mutate({
                        candidateId: c.id,
                        status: 'rejected',
                        payload: { action: c.action },
                      })
                    }
                  >
                    {t('progress.rhythm.later')}
                  </button>
                </div>
              </article>
            ))}
          {!strategy.selected.length && (
            <p className="text-sm text-ink-muted">{t('strategist.noActions')}</p>
          )}
          {(apply.isError || record.isError) && (
            <p role="alert" className="text-xs text-danger">
              {t('strategist.applyError')}
            </p>
          )}
          <button
            type="button"
            className="min-h-11 rounded-full bg-white/40 px-3 text-sm text-brand"
            disabled={
              !strategy.list.length ||
              !strategy.canGenerate ||
              strategy.generate.isPending ||
              availability.state !== 'ready'
            }
            onClick={() => strategy.generate.mutate()}
          >
            {t(strategy.generate.isPending ? 'strategist.loading' : 'strategist.ask')}
          </button>
          {strategy.generate.isError && (
            <p role="status" className="text-xs text-ink-muted">
              {t('strategist.aiUnavailable')}
            </p>
          )}
        </>
      )}
      {!inReview && (
        <Link
          to="/progress/week"
          className="flex min-h-11 items-center justify-center text-sm font-semibold text-brand"
        >
          {t('checkin.title')}
        </Link>
      )}
    </section>
  )
}

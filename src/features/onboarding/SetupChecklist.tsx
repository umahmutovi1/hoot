import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckIcon, ChevronRightIcon } from '@/components/icons'
import { useCalendarFeeds } from '@/features/calendars/api'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { useProfile } from '@/features/settings/profile'
import { isDefaultTemplate } from '@/lib/schedule/rhythm'
import { cn } from '@/lib/utils'
import { ONBOARDING_STEPS } from './steps'

/**
 * DanasPrazno: the onboarding steps that matter for an accurate plan, read from the data itself
 * (not from what was tapped). Open ones lead back to their step.
 */
export function SetupChecklist() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const { periodRows, timetableRows, rules } = useScheduleData()
  const feeds = useCalendarFeeds().data ?? []
  if (!profile) return null

  const items = [
    { id: 'rhythm', step: 3, done: Boolean(profile.name_confirmed_at && profile.wake_min) },
    { id: 'calendar', step: 2, done: periodRows.length > 0 },
    { id: 'days', step: 4, done: rules.length > 0 && !isDefaultTemplate(rules) },
    { id: 'timetable', step: 2, done: timetableRows.length > 0 || feeds.length > 0 },
  ] as const
  const open = items.filter((i) => !i.done).length
  if (open === 0) return null
  const stepsDone = Math.min(ONBOARDING_STEPS, ONBOARDING_STEPS - open)

  return (
    <section className="flex flex-col gap-2 rounded-card glass p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">
          {t('onboarding.checklist.title', { count: open })}
        </h2>
        <span className="text-xs text-ink-muted">
          {t('onboarding.checklist.progress', { done: stepsDone, total: ONBOARDING_STEPS })}
        </span>
      </div>
      <ul className="flex flex-col">
        {items.map((i) => (
          <li key={i.id}>
            <Link
              to={`/onboarding?step=${i.step}`}
              aria-disabled={i.done}
              className={cn(
                'flex min-h-11 items-center gap-3 py-1.5 text-[15px]',
                i.done && 'pointer-events-none text-ink-muted',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full',
                  i.done ? 'bg-success text-white' : 'border-2 border-radio-ring',
                )}
              >
                {i.done && <CheckIcon size={14} />}
              </span>
              <span className={cn('flex-1', i.done && 'line-through')}>
                {t(`onboarding.checklist.${i.id}`)}
              </span>
              {!i.done && <ChevronRightIcon size={16} className="text-ink-muted" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

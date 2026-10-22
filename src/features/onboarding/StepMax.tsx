import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile, useUpdateProfile } from '@/features/settings/profile'
import { formatDuration } from '@/features/sources/format'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { StepTitle, type StepProps } from './OnboardingPage'

const STEP = 30
const MIN = 30
const MAX = 480

/** Step 5 "Koliko najviše dnevno?": a cap for weekdays and one for the weekend. */
export function StepMax({ setSave }: StepProps) {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const { rules } = useScheduleData()
  const update = useUpdateProfile()
  const caps = profile?.daily_cap_min ?? [180, 180, 180, 180, 180, 300, 300]
  const [weekday, setWeekday] = useState(caps[0] ?? 180)
  const [weekend, setWeekend] = useState(caps[5] ?? 300)
  const has = (d: number) => rules.some((r) => r.weekday === d)
  const weekly = [0, 1, 2, 3, 4].filter(has).length * weekday + [5, 6].filter(has).length * weekend

  useEffect(() => {
    setSave(() =>
      update.mutateAsync({
        daily_cap_min: [weekday, weekday, weekday, weekday, weekday, weekend, weekend],
      }),
    )
  }, [weekday, weekend]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = [
    { label: t('onboarding.max.weekday'), value: weekday, set: setWeekday },
    { label: t('onboarding.max.weekend'), value: weekend, set: setWeekend },
  ]
  return (
    <>
      <StepTitle title={t('onboarding.max.title')} sub={t('onboarding.max.sub')} />
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-2.5 rounded-[22px] glass p-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold">{r.label}</span>
              <span className="text-[22px] font-semibold tabular-nums">
                {formatDuration(t, r.value)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => r.set(Math.max(MIN, r.value - STEP))}
                aria-label={t('onboarding.max.less', { what: r.label })}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-xl font-semibold"
              >
                −
              </button>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-hairline">
                <span
                  className="block h-full rounded-full bg-brand-accent"
                  style={{ width: `${(r.value / MAX) * 100}%` }}
                />
              </span>
              <button
                type="button"
                onClick={() => r.set(Math.min(MAX, r.value + STEP))}
                aria-label={t('onboarding.max.more', { what: r.label })}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-xl font-semibold"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1 rounded-[20px] bg-brand-soft px-4 py-3">
        <span className="text-[15px] font-semibold text-brand-strong">
          {t('onboarding.max.weekly', { time: formatDuration(t, weekly) })}
        </span>
        <span className="text-[13px] text-ink-secondary">{t('onboarding.max.reserve')}</span>
      </div>
    </>
  )
}

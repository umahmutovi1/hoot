import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfile, useUpdateProfile } from '@/features/settings/profile'
import { formatClock, parseClock } from '@/lib/schedule'
import { SLOT_PARTS, suggestDayStart, type Rhythm, type SlotPart } from '@/lib/schedule/rhythm'
import { cn } from '@/lib/utils'
import { StepTitle, type StepProps } from './OnboardingPage'
import { partsOf, rhythmOf } from './rhythmState'

/** Step 3 "Tvoj ritam": wake-up and bedtime (weekday / weekend) and the easiest time to study. */
export function StepRhythm({ setSave }: StepProps) {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const [rhythm, setRhythm] = useState<Rhythm>(() => rhythmOf(profile))
  const [parts, setParts] = useState<SlotPart[]>(() => {
    const saved = partsOf(profile)
    return saved.length > 0 ? saved : ['morning', 'evening']
  })
  const dayStart = suggestDayStart(rhythm.sleep)

  useEffect(() => {
    setSave(() =>
      update.mutateAsync({
        wake_min: rhythm.wake,
        sleep_min: rhythm.sleep,
        preferred_slots: parts,
        day_start_min: dayStart,
      }),
    )
  }, [rhythm, parts, dayStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const setTime = (key: 'wake' | 'sleep', i: 0 | 1, value: string) => {
    const m = parseClock(value)
    if (m === null) return
    setRhythm((r) => {
      const pair: [number, number] = [...r[key]]
      pair[i] = m
      return { ...r, [key]: pair }
    })
  }

  return (
    <>
      <StepTitle title={t('onboarding.rhythm.title')} sub={t('onboarding.rhythm.sub')} />
      {([0, 1] as const).map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <span className="px-1 text-xs font-semibold text-ink-muted uppercase">
            {i === 0 ? t('onboarding.rhythm.weekday') : t('onboarding.rhythm.weekend')}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(['wake', 'sleep'] as const).map((key) => (
              <label key={key} className="flex flex-col gap-0.5 rounded-[18px] glass px-3.5 py-2.5">
                <span className="text-xs text-ink-muted">{t(`onboarding.rhythm.${key}`)}</span>
                <input
                  type="time"
                  value={formatClock(rhythm[key][i])}
                  onChange={(e) => setTime(key, i, e.target.value)}
                  className="bg-transparent text-[22px] font-semibold tabular-nums outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <span className="text-[17px] font-semibold">{t('onboarding.rhythm.easiest')}</span>
        <div
          role="group"
          aria-label={t('onboarding.rhythm.easiest')}
          className="flex flex-wrap gap-1.5"
        >
          {SLOT_PARTS.map((p) => {
            const on = parts.includes(p)
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => setParts((ps) => (on ? ps.filter((x) => x !== p) : [...ps, p]))}
                className={cn(
                  'h-11 rounded-full px-4 text-sm font-semibold',
                  on ? 'bg-ink text-white' : 'bg-white/50 text-ink',
                )}
              >
                {t(`onboarding.part.${p}`)}
              </button>
            )
          })}
        </div>
        <span className="px-1 text-xs leading-[1.45] text-ink-muted">
          {t('onboarding.rhythm.hint', { time: formatClock(dayStart) })}
        </span>
      </div>
    </>
  )
}

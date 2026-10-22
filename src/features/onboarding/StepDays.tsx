import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAgenda } from '@/features/plan/agenda'
import { useReplaceRules } from '@/features/schedule/api'
import { useDayBoundary, useProfile } from '@/features/settings/profile'
import { addDays, localDay, startOfWeek } from '@/lib/day'
import { formatClock } from '@/lib/schedule'
import { proposeRules, SLOT_PARTS, type SlotPart } from '@/lib/schedule/rhythm'
import { cn } from '@/lib/utils'
import { StepTitle, type StepProps } from './OnboardingPage'
import { partsOf, rhythmOf } from './rhythmState'

const FROM = 6
const TO = 24
const PX = 13 // per hour

/**
 * Step 4 "Kad možeš učiti?": this week on a time axis. Classes and busy calendar time are
 * hatched; lavender are the proposed periods (awake time in the chosen parts of the day). A tap
 * on a day turns it off; the chips change the parts. "Dalje" replaces the 06–24 default.
 */
export function StepDays({ setSave }: StepProps) {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const boundary = useDayBoundary()
  const agenda = useAgenda()
  const replace = useReplaceRules()
  const rhythm = useMemo(() => rhythmOf(profile), [profile])
  const [parts, setParts] = useState<SlotPart[]>(() => partsOf(profile))
  const [off, setOff] = useState<Set<number>>(new Set())
  const [monday] = useState(() => startOfWeek(localDay(new Date(), boundary)))
  const rules = useMemo(() => proposeRules(rhythm, parts, off), [rhythm, parts, off])

  useEffect(() => {
    setSave(() =>
      replace.mutateAsync(
        rules.map((r) => ({ weekday: r.weekday, start_min: r.startMin, end_min: r.endMin })),
      ),
    )
  }, [rules]) // eslint-disable-line react-hooks/exhaustive-deps

  const top = (min: number) => (Math.max(FROM * 60, Math.min(TO * 60, min)) / 60 - FROM) * PX
  const weekdayShort = t('onboarding.days.weekdays').split(',')

  return (
    <>
      <StepTitle title={t('onboarding.days.title')} sub={t('onboarding.days.sub')} />
      <div className="flex gap-1 rounded-card glass p-3">
        <div className="relative w-6 shrink-0" style={{ height: (TO - FROM) * PX + 28 }}>
          {[6, 12, 18, 24].map((h) => (
            <span
              key={h}
              className="absolute right-0 -translate-y-1/2 text-[10px] text-ink-subtle"
              style={{ top: 28 + (h - FROM) * PX }}
            >
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>
        {Array.from({ length: 7 }, (_, weekday) => {
          const date = addDays(monday, weekday)
          const isOff = off.has(weekday)
          const busy = [
            ...agenda.classesFor(date).filter((c) => !c.cancelled),
            ...agenda.busyFor(date).filter((b) => !b.ignored),
          ]
          return (
            <button
              key={weekday}
              type="button"
              aria-pressed={!isOff}
              aria-label={weekdayShort[weekday]}
              onClick={() =>
                setOff((s) => {
                  const n = new Set(s)
                  if (n.has(weekday)) n.delete(weekday)
                  else n.add(weekday)
                  return n
                })
              }
              className="flex flex-1 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-[11px] font-semibold',
                  isOff ? 'bg-hairline text-ink-muted' : 'bg-ink text-white',
                )}
              >
                {weekdayShort[weekday]}
              </span>
              <span
                className="relative w-full rounded-lg bg-white/30"
                style={{ height: (TO - FROM) * PX }}
              >
                {rules
                  .filter((r) => r.weekday === weekday)
                  .map((r) => (
                    <span
                      key={r.startMin}
                      className="absolute inset-x-0 rounded-md bg-brand-accent/55"
                      style={{ top: top(r.startMin), height: top(r.endMin) - top(r.startMin) }}
                    />
                  ))}
                {busy.map((b) => (
                  <span
                    key={b.id}
                    className="absolute inset-x-0.5 rounded-md bg-[repeating-linear-gradient(135deg,var(--color-track)_0_4px,var(--color-canvas-soft)_4px_8px)]"
                    style={{
                      top: top(b.startMin),
                      height: Math.max(3, top(b.endMin) - top(b.startMin)),
                    }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>
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
                'h-10 rounded-full px-3.5 text-[13px] font-semibold',
                on ? 'bg-ink text-white' : 'bg-white/50 text-ink',
              )}
            >
              {t(`onboarding.part.${p}`)}
            </button>
          )
        })}
      </div>
      <span className="px-1 text-xs leading-[1.45] text-ink-muted">
        {parts.length === 0
          ? t('onboarding.days.allAwake', {
              from: formatClock(rhythm.wake[0]),
            })
          : t('onboarding.days.hint')}
      </span>
    </>
  )
}

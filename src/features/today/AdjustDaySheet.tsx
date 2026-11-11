import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { ChevronRightIcon, ClockIcon, MoonIcon, PlusIcon } from '@/components/icons'
import { BlockSheet } from '@/features/plan/BlockSheet'
import { useSessionUi } from '@/features/session/store'
import { useToast } from '@/components/toast-store'
import { useCantToday, useSetEnergy } from '@/features/plan/actions'
import { useDayEnergy } from '@/features/schedule/api'
import type { Energy } from '@/lib/energy'
import { isOpen, useGoalTitle } from '@/features/plan/model'
import { formatDuration } from '@/features/sources/format'
import { useLocale } from '@/features/settings/useLocale'
import { useSubjects } from '@/features/subjects/api'
import { toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { ONLY_MINUTES, pickFor, pickTitle, useStartPick } from './pick'
import type { PlanToday } from './usePlanToday'

/** Energy of the day as the three tiles show it (`lib/energy` levels). */
const LEVELS = ['low', 'normal', 'high'] as const satisfies readonly Energy[]

/** Row of the actions card: tinted icon tile, title and line under it, chevron when it opens more. */
const row = 'flex min-h-16 w-full items-center gap-3 py-2.5 pr-3 pl-3.5 text-left'
const tile = 'flex size-10 shrink-0 items-center justify-center rounded-[13px]'

/**
 * "Prilagodi dan" (DanasBrzo, PRD "Dopune, 5. nov 2026"): one sheet from the sliders icon next to
 * the Danas title instead of the button rows. Energy of the day (Malo / Normalno / Puno, with what
 * it changes), "Imam samo" 30 min / 1h / 1h 30, a free session, "Imam više vremena" (a new block)
 * and "Danas ne mogu". Energy applies at once; the others close this sheet and open their own.
 */
export function AdjustDaySheet({
  open,
  onOpenChange,
  plan,
  dayOff,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: PlanToday
  dayOff: boolean
}) {
  const { t } = useTranslation()
  const cantToday = useCantToday()
  const setEnergy = useSetEnergy()
  const openStart = useSessionUi((s) => s.openStart)
  const show = useToast((s) => s.show)
  const [only, setOnly] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const hasWork = plan.blocks.some((b) => isOpen(b) && b.on_date >= plan.today)
  const openToday = plan.todayBlocks.filter(isOpen)
  const energy =
    (useDayEnergy().data?.find((e) => e.on_date === plan.today)?.energy as Energy | undefined) ??
    'normal'

  const then = (next: () => void) => {
    onOpenChange(false)
    next()
  }
  const cant = async () => {
    onOpenChange(false)
    const undo = await cantToday(plan.today)
    show(t('today.cant.toast'), { label: t('today.cant.undo'), run: () => void undo() })
  }
  const effect =
    energy === 'normal'
      ? t('today.adjust.keep', {
          count: openToday.length,
          time: formatDuration(
            t,
            openToday.reduce((sum, b) => sum + b.planned_minutes, 0),
          ),
        })
      : t(`today.energy.toast.${energy}`)

  return (
    <>
      <BottomSheet open={open} onOpenChange={onOpenChange} title={t('today.adjust.title')}>
        {!dayOff && hasWork && (
          <div className="flex flex-col gap-2">
            <span className="px-1 text-[15px] font-bold">{t('today.adjust.feel')}</span>
            <div
              role="radiogroup"
              aria-label={t('today.adjust.feel')}
              className="grid grid-cols-3 gap-2"
            >
              {LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={energy === level}
                  onClick={() => void setEnergy(plan.today, level)}
                  className={cn(
                    'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-row px-1 py-1.5 transition-colors',
                    energy === level ? 'bg-brand text-ground' : 'surface text-ink',
                  )}
                >
                  <b className="text-[15px]">{t(`today.adjust.level.${level}`)}</b>
                  <span
                    className={cn(
                      'text-xs',
                      energy === level ? 'text-ground/82' : 'text-ink-secondary',
                    )}
                  >
                    {t(`today.adjust.level.${level}Sub`)}
                  </span>
                </button>
              ))}
            </div>
            <span role="status" className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
              {effect}
            </span>
          </div>
        )}
        <div className="surface flex flex-col overflow-hidden rounded-card">
          {hasWork && (
            <div>
              <div className={row}>
                <span className={cn(tile, 'bg-subject-blue-soft text-subject-blue-ink')}>
                  <ClockIcon size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="text-[15px]">{t('today.adjust.only')}</b>
                  <span className="text-[13px] leading-[1.35] text-ink-secondary">
                    {t('today.adjust.onlySub')}
                  </span>
                </span>
              </div>
              <div className="flex gap-1.5 pr-3 pb-3 pl-[66px]">
                {ADJUST_MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => then(() => setOnly(m))}
                    className="flex h-11 items-center rounded-xl bg-raised px-3 text-sm font-bold text-brand-strong tabular-nums"
                  >
                    {formatDuration(t, m)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => then(openStart)}
            className={cn(row, 'border-t border-hairline first:border-t-0')}
          >
            <span className={cn(tile, 'bg-subject-lavender-soft text-subject-lavender-ink')}>
              <PlayIcon />
            </span>
            <RowText title={t('session.start.free')} sub={t('session.start.freeSub')} />
          </button>
          <button
            type="button"
            onClick={() => then(() => setAdding(true))}
            className={cn(row, 'border-t border-hairline')}
          >
            <span className={cn(tile, 'bg-success-soft text-success-ink')}>
              <PlusIcon size={20} />
            </span>
            <RowText title={t('today.adjust.more')} sub={t('today.adjust.moreSub')} />
          </button>
          {!dayOff && openToday.length > 0 && (
            <button
              type="button"
              onClick={() => void cant()}
              className={cn(row, 'border-t border-hairline')}
            >
              <span className={cn(tile, 'bg-ai-soft text-warning-ink')}>
                <MoonIcon size={20} />
              </span>
              <RowText title={t('today.cant.button')} sub={t('today.adjust.cantSub')} />
            </button>
          )}
        </div>
      </BottomSheet>
      <OnlySheet
        open={only !== null}
        onOpenChange={(o) => !o && setOnly(null)}
        plan={plan}
        minutes={only ?? 30}
      />
      <BlockSheet
        open={adding}
        onOpenChange={setAdding}
        block={null}
        date={plan.today}
        today={plan.today}
      />
    </>
  )
}

const ADJUST_MINUTES = [30, 60, 90] as const

function RowText({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-[15px]">{title}</b>
        <span className="text-[13px] leading-[1.35] text-ink-secondary">{sub}</span>
      </span>
      <ChevronRightIcon size={20} className="shrink-0 text-ink-secondary" />
    </>
  )
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.89 12.85C18.54 14.19 16.87 15.14 13.53 17.04C10.3 18.87 8.68 19.79 7.38 19.42C6.84 19.27 6.35 18.98 5.96 18.58C5 17.61 5 15.74 5 12C5 8.26 5 6.39 5.96 5.42C6.35 5.02 6.84 4.73 7.38 4.58C8.68 4.21 10.3 5.13 13.53 6.96C16.87 8.86 18.54 9.81 18.89 11.15C19.04 11.71 19.04 12.29 18.89 12.85Z" />
    </svg>
  )
}

/** "Imam samo…" sheet: 15 / 30 / 45 / 60 min and the most valuable piece for that time. */
export function OnlySheet({
  open,
  onOpenChange,
  plan,
  minutes = 30,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: PlanToday
  /** The time picked first (Prilagodi dan offers 30 min, 1h and 1h 30). */
  minutes?: number
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('today.only.title')}>
      {open && <OnlyForm plan={plan} initial={minutes} onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  )
}

function OnlyForm({
  plan,
  initial,
  onDone,
}: {
  plan: PlanToday
  initial: number
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [minutes, setMinutes] = useState<number>(initial)
  const options = [...new Set<number>([...ONLY_MINUTES, initial])].sort((a, b) => a - b)
  const { data: subjects = [] } = useSubjects()
  const startPick = useStartPick(plan)
  const goalTitle = useGoalTitle()
  const pick = pickFor(plan, minutes)
  const block = pick ? plan.blocks.find((b) => b.id === pick.blockId) : undefined
  const later =
    pick?.from === 'next'
      ? plan.blocks.find(
          (b) => isOpen(b) && b.on_date > plan.today && b.subject_id === pick.subjectId,
        )
      : undefined
  const subjectName = subjects.find((s) => s.id === pick?.subjectId)?.name ?? ''

  const why = !pick
    ? null
    : pick.from === 'review'
      ? t('today.only.whyReview', { minutes: formatDuration(t, pick.minutes) })
      : pick.from === 'today'
        ? block && pick.minutes < block.planned_minutes
          ? t('today.only.whyPart')
          : t('today.only.whyWhole')
        : t('today.only.whyNext', {
            day: later
              ? format(toDisplayDate(later.on_date), 'EEEE', { locale: dateFnsLocales[locale] })
              : '',
          })

  const start = async () => {
    if (!pick) return
    await startPick(pick)
    onDone()
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-2" role="radiogroup" aria-label={t('today.only.title')}>
        {options.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === minutes}
            onClick={() => setMinutes(m)}
            className={cn(
              'h-12 flex-1 rounded-full text-[15px] font-semibold',
              m === minutes ? 'bg-ink text-white' : 'surface text-ink',
            )}
          >
            {formatDuration(t, m)}
          </button>
        ))}
      </div>
      {pick ? (
        <>
          <div className="flex flex-col gap-1 rounded-[20px] bg-white/70 px-4 py-3.5">
            <span className="text-xs font-semibold text-ink-muted uppercase">
              {t('today.only.best')}
            </span>
            <span className="text-[17px] font-semibold">
              {pickTitle(
                t,
                pick,
                plan.units,
                subjectName,
                goalTitle((block ?? later)?.deadline_id ?? ''),
              )}
            </span>
            {why && <span className="text-[13px] text-ink-secondary">{why}</span>}
          </div>
          <button
            type="button"
            onClick={() => void start()}
            className="btn-primary flex h-[52px] items-center justify-center rounded-full text-[15px] font-semibold"
          >
            {t('today.only.start', { minutes })}
          </button>
          {block && pick.minutes < block.planned_minutes && (
            <span className="text-center text-xs text-ink-muted">{t('today.only.rest')}</span>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-muted">{t('today.only.nothing')}</p>
      )}
    </div>
  )
}

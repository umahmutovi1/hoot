import { format } from 'date-fns'
import { dateFnsLocales } from '@/lib/locale'
import { useLocale } from '@/features/settings/useLocale'
import { useStrategist } from './useStrategist'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { PageTitle } from '@/components/PageTitle'
import { useToast } from '@/components/toast-store'
import { ProgressProvider, useProgress } from '@/features/progress/useProgress'
import { SlotMap } from '@/features/progress/SlotMap'
import { ForecastCard } from '@/features/progress/ForecastCard'
import { DaySheet } from '@/features/schedule/DaySheet'
import { useScheduleData } from '@/features/schedule/useScheduleData'
import { formatDuration } from '@/features/sources/format'
import { toDisplayDate, addDays } from '@/lib/day'
import { recallShare, weekWindow } from '@/lib/progress/week'
import { retrievabilityOn, weightedStrength, unitStrength } from '@/lib/srs'
import { memoryOf } from '@/features/review/memory'
import { supabase } from '@/lib/supabase'
import { InsightsPanel } from './InsightsPanel'
import { StrategistCard } from './StrategistCard'
import { historicalMemory, useInsightData } from './useInsights'
import { latestFeedback, useFeedback, useRecordFeedback } from './feedback'

const dailySchema = z.object({
  daily: z.array(
    z.object({
      day: z.string(),
      minutes: z.number(),
      planned: z.number(),
      done: z.number(),
      blocks: z.number(),
    }),
  ),
})
export function WeeklyReviewPage() {
  return (
    <ProgressProvider>
      <WeeklyReview />
    </ProgressProvider>
  )
}
function WeeklyReview() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const strategy = useStrategist()
  const data = useProgress(),
    insight = useInsightData(),
    feedback = useFeedback()
  const navigate = useNavigate(),
    record = useRecordFeedback(),
    toast = useToast((s) => s.show)
  const schedule = useScheduleData()
  const [editDate, setEditDate] = useState<string | null>(null)
  const window = data ? weekWindow(data.today) : null
  const rates = useMemo(
    () =>
      Object.fromEntries(
        data?.model.built.state.units.map((u) => {
          const raw = data.inputs.sources.flatMap((s) => s.units).find((x) => x.id === u.id)
          return [u.id, u.minutes / Math.max(1, raw?.amount ?? 1)]
        }) ?? [],
      ),
    [data],
  )
  const stats = useQuery({
    queryKey: ['week-statistics', data?.inputs.profile.id, window?.from, rates],
    enabled: Boolean(data && window),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('progress_statistics', {
        p_from: window!.previousFrom,
        p_to: window!.to,
        p_rates: rates,
      })
      if (error) throw error
      return dailySchema.parse(data).daily
    },
  })
  if (!data || !window) return <p className="text-sm text-ink-muted">{t('insights.loading')}</p>
  const fmt = (date: string) =>
    format(toDisplayDate(date), 'd. MMM', { locale: dateFnsLocales[locale] })
  const sum = (from: string, to: string) =>
    stats.data
      ?.filter((d) => d.day >= from && d.day <= to)
      .reduce(
        (a, d) => ({
          minutes: a.minutes + d.minutes,
          planned: a.planned + d.planned,
          done: a.done + d.done,
          blocks: a.blocks + d.blocks,
        }),
        { minutes: 0, planned: 0, done: 0, blocks: 0 },
      )
  const current = sum(window.from, window.to),
    previous = sum(window.previousFrom, window.previousTo)
  const modes = (from: string, to: string) =>
    insight?.minutes
      .filter((r) => r.onDate >= from && r.onDate <= to)
      .map((r) => ({ mode: r.session.mode, minutes: r.minutes })) ?? []
  const recall = recallShare(modes(window.from, window.to)),
    prevRecall = recallShare(modes(window.previousFrom, window.previousTo))
  const ids = data.forecasts[0]?.goal.unitIds ?? []
  const strengthAt = (unitIds: string[], on: string) =>
    weightedStrength(
      data.model.built.state.units
        .filter((u) => unitIds.includes(u.id))
        .map((u) => {
          const unit = data.inputs.sources.flatMap((s) => s.units).find((x) => x.id === u.id)
          const boundary = {
            timeZone: data.inputs.profile.timezone,
            dayStartMin: data.inputs.profile.day_start_min,
          }
          const own =
            historicalMemory(insight?.history.reviews ?? [], u.id, on, boundary) ??
            (u.memory && u.memory.lastReviewOn <= on ? u.memory : null)
          const cardValues = data.inputs.cards
            .filter((c) => c.unit_id === u.id)
            .flatMap((c) => {
              const m = memoryOf(c, boundary)
              return m && m.lastReviewOn <= on
                ? [retrievabilityOn(m, on, data.model.built.state.fsrsParams)]
                : []
            })
          return {
            minutes: u.minutes,
            strength: unit
              ? unitStrength(
                  own ? retrievabilityOn(own, on, data.model.built.state.fsrsParams) : null,
                  cardValues,
                )
              : null,
          }
        }),
    )
  const strength = strengthAt(ids, window.to),
    prevStrength = strengthAt(ids, window.previousTo)
  const checkinId = `checkin:${window.nextFrom}`
  const saved = latestFeedback(feedback.data ?? [], checkinId)
  const stored = reflectionSchema.safeParse(saved?.payload)
  const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`)
  const delta = (a: number | null | undefined, b: number | null | undefined, suffix: string) =>
    a == null || b == null
      ? '—'
      : `${a > b ? '↑' : a < b ? '↓' : '→'} ${Math.round(Math.abs(a - b))} ${suffix}`
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{t('checkin.title')}</PageTitle>
      <p className="text-sm text-ink-muted">
        {fmt(window.from)} – {fmt(window.to)} · {t('checkin.duration')}
      </p>
      <section className="glass flex flex-col gap-2 rounded-card p-4">
        <h2 className="text-base font-semibold">{t('checkin.summaryTitle')}</h2>
        <p className="text-sm text-ink-secondary">
          {strategy.output?.summary ??
            t('checkin.summary', { hours: current ? formatDuration(t, current.minutes) : '—' })}
        </p>
      </section>
      <section className="glass grid grid-cols-2 gap-5 rounded-card p-4">
        <NumberCard
          value={current ? formatDuration(t, current.minutes) : '—'}
          label={t('checkin.vsPlan', { hours: current ? formatDuration(t, current.planned) : '—' })}
          delta={delta(current?.minutes, previous?.minutes, t('checkin.minuteDelta'))}
        />
        <NumberCard
          value={current ? `${current.done}/${current.blocks}` : '—'}
          label={t('checkin.doneBlocks')}
          delta={delta(current?.done, previous?.done, t('checkin.blockDelta'))}
        />
        <NumberCard
          value={pct(recall)}
          label={t('checkin.recall')}
          delta={delta(
            recall === null ? null : recall * 100,
            prevRecall === null ? null : prevRecall * 100,
            t('checkin.pp'),
          )}
        />
        <NumberCard
          value={pct(strength)}
          label={t('checkin.strength', { subject: data.forecasts[0]?.subject.name ?? '—' })}
          delta={delta(
            strength === null ? null : strength * 100,
            prevStrength === null ? null : prevStrength * 100,
            t('checkin.pp'),
          )}
        />
      </section>
      {stats.isError && (
        <p role="status" className="text-xs text-ink-muted">
          {t('progress.statistics.error')}
        </p>
      )}
      <InsightsPanel review />
      <section className="glass flex flex-col gap-3 rounded-card p-4">
        <h2 className="text-base font-semibold">{t('checkin.subjects')}</h2>
        {data.inputs.subjects
          .filter((s) => !s.archived)
          .map((s) => {
            const blocks = data.inputs.blocks.filter(
              (b) => b.subject_id === s.id && b.on_date >= window.from && b.on_date <= window.to,
            )
            const done = blocks.filter((b) => b.status === 'done').length
            const strength = strengthAt(
              data.model.built.state.units.filter((u) => u.subjectId === s.id).map((u) => u.id),
              window.to,
            )
            return (
              <div
                key={s.id}
                className="flex flex-col gap-1.5 border-b border-hairline pb-3 last:border-0"
              >
                <h3 className="text-sm font-semibold">{s.name}</h3>
                <p className="text-xs text-ink-muted">
                  {t('checkin.subjectLine', {
                    completion: blocks.length
                      ? `${Math.round((done / blocks.length) * 100)}%`
                      : '—',
                    strength: pct(strength),
                  })}
                </p>
                <div className="h-1.5 rounded-full bg-track">
                  <div
                    className="h-full rounded-full bg-brand-accent"
                    style={{ width: `${blocks.length ? (done / blocks.length) * 100 : 0}%` }}
                  />
                </div>
                {insight?.list.some((i) => i.kind === 'avoidance' && i.subjectId === s.id) && (
                  <p className="text-xs text-ink-secondary">{t('checkin.avoided')}</p>
                )}
              </div>
            )
          })}
      </section>
      <SlotMap />
      <ReflectionForm
        key={saved?.id ?? checkinId}
        initial={stored.success ? stored.data : undefined}
        busy={record.isPending}
        onSave={(reflection) =>
          void record
            .mutateAsync({
              insightId: checkinId,
              status: 'accepted',
              payload: { kind: 'checkin', week: window.nextFrom, ...reflection },
            })
            .then(() => {
              toast(t('checkin.saved'))
              navigate('/progress')
            })
            .catch(() => {})
        }
      >
        <section className="glass flex flex-col gap-3 rounded-card p-4">
          <h2 className="text-base font-semibold">{t('checkin.nextWeek')}</h2>
          <p className="text-xs text-ink-muted">
            {fmt(window.nextFrom)} – {fmt(window.nextTo)} · {t('checkin.exceptionsHint')}
          </p>
          {Array.from({ length: 7 }, (_, i) => addDays(window.nextFrom, i)).map((date) => (
            <button
              type="button"
              key={date}
              className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white/30 px-3 text-sm"
              onClick={() => setEditDate(date)}
            >
              <span>{fmt(date)}</span>
              <span className="text-xs text-brand">
                {t(
                  schedule.dayRows.some((d) => d.on_date === date) ||
                    schedule.exceptionRows.some((e) => e.on_date === date)
                    ? 'checkin.editException'
                    : 'checkin.addException',
                )}
              </span>
            </button>
          ))}
        </section>
        <ForecastCard />
        <StrategistCard
          inReview
          maxActions={Math.max(
            0,
            3 - (insight?.list.slice(0, 3).filter((i) => i.action).length ?? 0),
          )}
        />
      </ReflectionForm>
      {record.isError && (
        <p role="alert" className="text-sm text-danger">
          {t('strategist.applyError')}
        </p>
      )}
      <DaySheet
        date={editDate ?? window.nextFrom}
        open={editDate !== null}
        onOpenChange={(open) => !open && setEditDate(null)}
      />
    </div>
  )
}
function NumberCard({ value, label, delta }: { value: string; label: string; delta: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xl font-semibold">{value}</span>
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-xs text-brand">{delta}</span>
    </div>
  )
}
const reflectionSchema = z.object({
  worked: z.string().max(2000),
  stuck: z.string().max(2000),
  chips: z.array(z.string()).max(5),
})
type Reflection = z.infer<typeof reflectionSchema>
function ReflectionForm({
  initial,
  busy,
  onSave,
  children,
}: {
  initial?: Reflection
  busy: boolean
  onSave: (value: Reflection) => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState<Reflection>(initial ?? { worked: '', stuck: '', chips: [] })
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(value)
      }}
    >
      <section className="glass flex flex-col gap-3 rounded-card p-4">
        <h2 className="text-base font-semibold">{t('checkin.reflection')}</h2>
        <label htmlFor="worked" className="text-sm">
          {t('checkin.worked')}
        </label>
        <textarea
          id="worked"
          maxLength={2000}
          rows={2}
          value={value.worked}
          onChange={(e) => setValue({ ...value, worked: e.target.value })}
          className="w-full rounded-2xl bg-white/40 p-3 text-sm"
        />
        <label htmlFor="stuck" className="text-sm">
          {t('checkin.stuck')}
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('checkin.stuck')}>
          {(['tired', 'phone', 'hard', 'unmotivated', 'busy'] as const).map((chip) => (
            <button
              type="button"
              key={chip}
              aria-pressed={value.chips.includes(chip)}
              className={`min-h-11 rounded-full px-3 text-xs ${value.chips.includes(chip) ? 'bg-brand text-white' : 'bg-white/40'}`}
              onClick={() =>
                setValue({
                  ...value,
                  chips: value.chips.includes(chip)
                    ? value.chips.filter((x) => x !== chip)
                    : [...value.chips, chip],
                })
              }
            >
              {t(`checkin.chips.${chip}`)}
            </button>
          ))}
        </div>
        <textarea
          id="stuck"
          maxLength={2000}
          rows={2}
          value={value.stuck}
          onChange={(e) => setValue({ ...value, stuck: e.target.value })}
          className="w-full rounded-2xl bg-white/40 p-3 text-sm"
        />
        <p className="text-xs text-ink-muted">{t('checkin.privacy')}</p>
      </section>
      {children}
      <button
        type="submit"
        className="btn-primary min-h-11 rounded-full px-4 text-sm font-semibold"
        disabled={busy}
      >
        {t('checkin.save')}
      </button>
    </form>
  )
}

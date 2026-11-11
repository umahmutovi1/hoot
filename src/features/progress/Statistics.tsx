import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { SLOT_PARTS } from '@/lib/schedule/rhythm'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@/features/auth/auth-context'
import { usePresets, presetName } from '@/features/session/presets'
import { weekdayOf, addDays } from '@/lib/day'
import { supabase } from '@/lib/supabase'
import { useProgress } from './useProgress'

const metric = z.object({
  sessions: z.number(),
  focus: z.number().nullable(),
  speed: z.number().nullable(),
})
const statisticsSchema = z.object({
  daily: z.array(
    z.object({
      day: z.string(),
      minutes: z.number(),
      planned: z.number(),
      blocks: z.number(),
      done: z.number(),
    }),
  ),
  presets: z.array(metric.extend({ id: z.string().nullable() })),
  slots: z.array(metric.extend({ part: z.enum(SLOT_PARTS) })),
  focus: z.number().nullable(),
  sessions: z.number(),
})
export function Statistics() {
  const { t, i18n } = useTranslation()
  const data = useProgress()
  const userId = useAuth().session?.user.id
  const presets = usePresets()
  const [period, setPeriod] = useState(7)
  const rates = useMemo(
    () =>
      Object.fromEntries(
        data?.model.built.state.units.map((u) => {
          const source = data.inputs.sources.find((s) => s.id === u.sourceId)
          const raw = source?.units.find((x) => x.id === u.id)
          return [u.id, u.minutes / Math.max(1, raw?.amount ?? 1)]
        }) ?? [],
      ),
    [data],
  )
  const to = data ? addDays(data.today, period === 7 ? -weekdayOf(data.today) - 1 : -1) : ''
  const from = to ? addDays(to, -(period - 1)) : ''
  const stats = useQuery({
    queryKey: ['progress', userId, 'statistics', from, to, rates],
    enabled: Boolean(data && userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('progress_statistics', {
        p_from: from,
        p_to: to,
        p_rates: rates,
      })
      if (error) throw error
      return statisticsSchema.parse(data)
    },
  })
  const fmt = (n: number, digits = 1) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: digits }).format(n)
  const totals = stats.data?.daily.reduce(
    (a, d) => ({
      minutes: a.minutes + d.minutes,
      planned: a.planned + d.planned,
      done: a.done + d.done,
      blocks: a.blocks + d.blocks,
    }),
    { minutes: 0, planned: 0, done: 0, blocks: 0 },
  )
  return (
    <section className="surface flex flex-col gap-3 rounded-card p-4">
      <h2 className="text-base font-semibold">{t('progress.statistics.title')}</h2>
      <div className="flex rounded-full bg-white/30 p-1">
        {[7, 30].map((n) => (
          <button
            type="button"
            key={n}
            aria-pressed={period === n}
            onClick={() => setPeriod(n)}
            className={`min-h-11 flex-1 rounded-full text-sm ${period === n ? 'bg-white/70' : ''}`}
          >
            {t(n === 7 ? 'progress.statistics.week' : 'progress.statistics.month')}
          </button>
        ))}
      </div>
      {stats.isError ? (
        <>
          <p role="alert" className="text-sm text-ink-secondary">
            {t('progress.statistics.error')}
          </p>
          <button
            type="button"
            className="min-h-11 text-brand"
            onClick={() => void stats.refetch()}
          >
            {t('progress.statistics.retry')}
          </button>
        </>
      ) : !totals ? (
        <p className="text-sm text-ink-muted">{t('progress.statistics.loading')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label={t('progress.statistics.hours')}
              value={t('progress.statistics.hoursValue', {
                actual: fmt(totals.minutes / 60),
                planned: fmt(totals.planned / 60),
              })}
            />
            <Stat
              label={t('progress.statistics.fulfilment')}
              value={
                totals.planned ? `${Math.round((totals.minutes / totals.planned) * 100)}%` : '—'
              }
            />
            <Stat
              label={t('progress.statistics.blocks')}
              value={`${totals.done}/${totals.blocks}`}
            />
            <Stat
              label={t('progress.statistics.focus')}
              value={stats.data?.focus == null ? '—' : `${fmt(stats.data.focus)}/3`}
            />
            <Stat
              label={t('progress.statistics.rho')}
              value={data ? fmt(data.model.built.state.rho) : '—'}
            />
            <Stat
              label={t('progress.statistics.sessions')}
              value={String(stats.data?.sessions ?? 0)}
            />
          </div>
          <div className="h-52 w-full" aria-label={t('progress.statistics.hours')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.data!.daily.map((d) => ({
                  ...d,
                  actual: d.minutes / 60,
                  plan: d.planned / 60,
                  label: d.day.slice(8),
                }))}
              >
                <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis width={25} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="plan"
                  name={t('progress.statistics.planned')}
                  fill="var(--color-track)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="actual"
                  name={t('progress.statistics.actual')}
                  fill="var(--color-brand-accent)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <h3 className="text-sm font-semibold">{t('progress.statistics.efficiency')}</h3>
          {stats.data!.slots.map((s) => (
            <div key={s.part} className="flex justify-between gap-2 text-sm">
              <span>{t(`progress.parts.${s.part}`)}</span>
              <span>
                {s.sessions >= 6 && s.speed !== null
                  ? `${fmt(s.speed, 2)}×`
                  : t('progress.statistics.more', { count: Math.max(0, 6 - s.sessions) })}
              </span>
            </div>
          ))}
          <h3 className="text-sm font-semibold">{t('progress.statistics.presets')}</h3>
          {stats.data!.presets.map((p) => (
            <div
              key={p.id ?? 'free'}
              className="flex items-center justify-between gap-3 border-b border-hairline py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate">{presetName(t, presets.resolve(p.id))}</span>
                <span className="text-xs text-ink-muted">
                  {t('progress.statistics.presetSessions', { count: p.sessions })}
                </span>
              </span>
              <span className="shrink-0 text-xs">
                {p.sessions >= 5
                  ? `${p.focus === null ? '—' : fmt(p.focus)} · ${p.speed === null ? '—' : `${fmt(p.speed, 2)}×`}`
                  : t('progress.statistics.more', { count: 5 - p.sessions })}
              </span>
            </div>
          ))}
          <p className="text-xs text-ink-muted">{t('progress.statistics.speedHint')}</p>
        </>
      )}
    </section>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xl font-semibold">{value}</span>
      <span className="text-xs text-ink-secondary">{label}</span>
    </div>
  )
}

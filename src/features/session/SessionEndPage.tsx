import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { OfflineNotice } from '@/components/OfflineNotice'
import { CheckIcon } from '@/components/icons'
import { syncQueueFor } from '@/app/sync'
import { useAuth } from '@/features/auth/auth-context'
import { useOnline } from '@/features/owl/api'
import { useSources } from '@/features/sources/api'
import { statusLabel, STATUS_CHIP } from '@/features/sources/format'
import type { SourceWithUnits } from '@/features/sources/model'
import { useDayBoundary } from '@/features/settings/profile'
import { localDay } from '@/lib/day'
import { useSubject } from '@/features/subjects/api'
import { pageOffset } from '@/lib/session/coverage'
import type { Op } from '@/lib/sync'
import { cn } from '@/lib/utils'
import { useSession, useSessionUnits, useSessionWriter, type SessionUnitRow } from './api'
import {
  coveredUnits,
  defaultLevel,
  endLevels,
  planEnd,
  savedRanges,
  summarize,
  type EndAnswers,
  type Range,
} from './end'
import { toEndSources, sessionSources, unitTitle, type SessionSource } from './material'
import { useSessionUi } from './store'
import { EndActions } from './EndActions'
import { SessionHeader } from './SessionHeader'

interface RangeDraft {
  sourceId: string
  fromUnit: string
  fromPage: number | null
  toUnit: string
  toPage: number | null
}

const usesPages = (s: SessionSource) => s.measure === 'pages' || s.measure === 'slides'

function toRange(s: SessionSource, d: RangeDraft): Range {
  const from = s.leaves.find((u) => u.id === d.fromUnit)
  const to = s.leaves.find((u) => u.id === d.toUnit)
  const fromOffset =
    usesPages(s) && from?.page_start != null && d.fromPage !== null
      ? d.fromPage - from.page_start
      : 0
  const toOffset =
    usesPages(s) && to?.page_start != null && d.toPage !== null
      ? pageOffset(to.page_start, d.toPage)
      : Number(to?.amount ?? 0)
  return {
    sourceId: s.source.id,
    from: { unitId: d.fromUnit, offset: fromOffset },
    to: { unitId: d.toUnit, offset: toOffset },
  }
}

/** Reasons for low focus (`study_sessions.focus_reasons`); they separate a bad slot from hard material. */
const FOCUS_REASONS = ['tired', 'phone', 'noise', 'hard', 'sleep'] as const

/** Studied units per source, from the first to the last one in source order. */
function initialRanges(sources: SessionSource[], unitIds: (string | null)[]): RangeDraft[] {
  const out: RangeDraft[] = []
  for (const s of sources) {
    const idx = unitIds.map((id) => s.leaves.findIndex((u) => u.id === id)).filter((i) => i >= 0)
    if (idx.length === 0) continue
    const from = s.leaves[Math.min(...idx)]!
    const to = s.leaves[Math.max(...idx)]!
    out.push({
      sourceId: s.source.id,
      fromUnit: from.id,
      fromPage: from.page_start,
      toUnit: to.id,
      toPage: to.page_end ?? to.page_start,
    })
  }
  return out
}

/** Saved ranges back as drafts (pages for page-based sources). */
function draftsOf(sources: SessionSource[], ranges: Range[]): RangeDraft[] {
  return ranges.flatMap((r) => {
    const s = sources.find((x) => x.source.id === r.sourceId)
    const from = s?.leaves.find((u) => u.id === r.from.unitId)
    const to = s?.leaves.find((u) => u.id === r.to.unitId)
    if (!s || !from || !to) return []
    return [
      {
        sourceId: r.sourceId,
        fromUnit: from.id,
        fromPage: from.page_start === null ? null : from.page_start + r.from.offset,
        toUnit: to.id,
        toPage: to.page_start === null ? null : to.page_start + r.to.offset - 1,
      },
    ]
  })
}

/**
 * KrajSesije: how far, difficulty per unit, focus, reflection. Opened from the history
 * (`?from=history`) it edits the saved answers instead.
 */
export function SessionEndPage() {
  const { id } = useParams()
  const online = useOnline()
  const { data, isPending } = useSession(id)
  const { data: sourceRows, isPending: sourcesPending } = useSources(data?.session.subject_id)
  const { data: saved, isPending: savedPending } = useSessionUnits(id)

  if (isPending || (data && (sourcesPending || savedPending) && online)) return null
  if (!data) return online ? <Navigate to="/" replace /> : <OfflineNotice />
  if (!data.session.ended_at) return <Navigate to="/session" replace />
  return <EndForm data={data} sourceRows={sourceRows ?? []} saved={saved ?? []} />
}

function EndForm({
  data,
  sourceRows,
  saved,
}: {
  data: NonNullable<ReturnType<typeof useSession>['data']>
  sourceRows: SourceWithUnits[]
  saved: SessionUnitRow[]
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = useAuth().session?.user.id
  const writer = useSessionWriter()
  const { session, segments } = data
  const { data: subject } = useSubject(session.subject_id)
  const sources = sessionSources(sourceRows)
  const studied = segments.map((s) => s.unit_id)
  const [params] = useSearchParams()
  const fromHistory = params.get('from') === 'history'
  const needsRecalibration = useSessionUi((s) => s.needsRecalibration)
  const endSources = toEndSources(sources)

  const [ranges, setRanges] = useState<RangeDraft[]>(() =>
    saved.length > 0
      ? draftsOf(sources, savedRanges(endSources, saved))
      : initialRanges(sources, studied),
  )
  const [ratings, setRatings] = useState<Record<string, number>>(() =>
    Object.fromEntries(saved.flatMap((r) => (r.difficulty ? [[r.unit_id, r.difficulty]] : []))),
  )
  const [levels, setLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      saved.flatMap((r) => (r.level_after === null ? [] : [[r.unit_id, r.level_after]])),
    ),
  )
  const [focus, setFocus] = useState<number | null>(session.focus)
  const [reasons, setReasons] = useState<string[]>(session.focus_reasons ?? [])
  const [reflection, setReflection] = useState(session.reflection ?? '')
  const [busy, setBusy] = useState(false)

  const answers: EndAnswers = {
    ranges: ranges.flatMap((d) => {
      const s = sources.find((x) => x.source.id === d.sourceId)
      return s ? [toRange(s, d)] : []
    }),
    ratings,
    levels,
    focus,
    focusReasons: reasons,
    reflection,
  }
  const boundary = useDayBoundary()
  const endedAt = new Date(session.ended_at!)
  const today = fromHistory ? null : localDay(endedAt, boundary)
  const plan = planEnd(session, segments, endSources, answers, endedAt, saved, today)
  const covered = coveredUnits(endSources, answers.ranges)
  const summary = summarize(session, segments, new Date(session.ended_at ?? session.started_at))

  const cards = sources.flatMap((s) =>
    s.leaves
      .filter((u) => covered.has(u.id) || plan.minutes.has(u.id))
      .map((unit) => ({ source: s, unit })),
  )
  const main = sources.find((s) => s.source.id === ranges[0]?.sourceId)
  const mainAmount = main
    ? main.leaves.reduce((sum, u) => sum + (covered.get(u.id)?.amountDone ?? 0), 0)
    : 0
  const mainMinutes = main
    ? main.leaves.reduce((sum, u) => sum + (plan.minutes.get(u.id) ?? 0), 0)
    : 0
  const showRate = main && main.source.kind !== 'questions' && mainAmount > 0

  // "Spasi i testiraj se" opens the recall gate for what was read; "Samo spasi" records the skip.
  const gate = fromHistory ? [] : plan.gate
  const save = async (test: boolean) => {
    if (!userId || busy) return
    setBusy(true)
    const { ops } =
      gate.length > 0 && !test
        ? planEnd(
            session,
            segments,
            endSources,
            { ...answers, skipGate: true },
            endedAt,
            saved,
            today,
          )
        : plan
    patchSources(queryClient, userId, session.subject_id, ops)
    await writer.write(ops)
    if (session.origin === 'timer') needsRecalibration(session.subject_id)
    const queue = syncQueueFor(userId)
    if (navigator.onLine)
      void queue.flush().then(() => queryClient.invalidateQueries({ queryKey: ['sources'] }))
    if (test)
      navigate(`/session/recall?units=${gate.join(',')}&session=${session.id}`, { replace: true })
    else navigate(fromHistory ? `/sessions/${session.id}` : '/', { replace: true })
  }

  const addRange = (s: SessionSource) => {
    const u = s.leaves.find((x) => x.level === 0) ?? s.leaves[0]!
    setRanges((r) => [
      ...r,
      {
        sourceId: s.source.id,
        fromUnit: u.id,
        fromPage: u.page_start,
        toUnit: u.id,
        toPage: u.page_end ?? u.page_start,
      },
    ])
  }

  return (
    <div className={cn('flex flex-col gap-4', !fromHistory && 'pt-[env(safe-area-inset-top)]')}>
      {fromHistory ? (
        <SessionHeader
          title={t('session.history.editEnd')}
          subtitle={subject?.name}
          fallback={`/sessions/${session.id}`}
        />
      ) : (
        <div className="flex flex-col items-center gap-2.5 pt-2">
          <span
            aria-hidden="true"
            className="icon-tile flex size-16 items-center justify-center rounded-[20px]"
          >
            <CheckIcon size={30} />
          </span>
          <h1 className="text-[26px] font-bold">{t('session.end.title')}</h1>
          <p className="text-center text-sm text-ink-muted">
            {[
              subject?.name,
              t('session.end.studied', { count: Math.round(summary.activeMin) }),
              t('session.end.pauses', { count: summary.pauses }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      )}
      {!fromHistory && session.origin === 'timer' && (
        <EndActions data={data} studiedMin={Math.round(summary.activeMin)} />
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat
          value={String(Math.round(summary.activeMin))}
          label={
            session.planned_minutes
              ? t('session.end.minOf', { planned: session.planned_minutes })
              : t('session.end.min')
          }
        />
        <Stat
          value={main ? String(Math.round(mainAmount)) : '–'}
          label={
            main
              ? t(`session.end.amount.${main.measure}`, { count: Math.round(mainAmount) })
              : t('session.end.noAmount')
          }
        />
        <Stat
          value={
            showRate
              ? (mainMinutes / mainAmount).toLocaleString(undefined, { maximumFractionDigits: 1 })
              : '–'
          }
          label={main ? t(`session.end.rate.${main.measure}`) : t('session.end.rate.pages')}
        />
      </div>

      <h2 className="mt-1 text-lg font-semibold">{t('session.end.howFar')}</h2>
      {ranges.map((d, i) => {
        const s = sources.find((x) => x.source.id === d.sourceId)
        if (!s) return null
        const set = (patch: Partial<RangeDraft>) =>
          setRanges((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
        return (
          <div key={d.sourceId + i} className="flex flex-col gap-3 rounded-[24px] glass p-4">
            <span className="text-[15px] font-semibold">{s.source.title}</span>
            <RangeRow
              label={t('session.end.from')}
              source={s}
              unitId={d.fromUnit}
              page={d.fromPage}
              onUnit={(u) => set({ fromUnit: u.id, fromPage: u.page_start })}
              onPage={(p) => set({ fromPage: p })}
            />
            <RangeRow
              label={t('session.end.to')}
              source={s}
              unitId={d.toUnit}
              page={d.toPage}
              onUnit={(u) => set({ toUnit: u.id, toPage: u.page_end ?? u.page_start })}
              onPage={(p) => set({ toPage: p })}
            />
          </div>
        )
      })}
      {sources.filter((s) => !ranges.some((r) => r.sourceId === s.source.id)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sources
            .filter((s) => !ranges.some((r) => r.sourceId === s.source.id))
            .map((s) => (
              <button
                key={s.source.id}
                type="button"
                onClick={() => addRange(s)}
                className="flex h-11 items-center rounded-full glass px-4 text-[13px] font-semibold text-brand"
              >
                + {s.source.title}
              </button>
            ))}
        </div>
      )}

      {cards.length > 0 && (
        <h2 className="mt-1 text-lg font-semibold">{t('session.end.difficulty')}</h2>
      )}
      {cards.map(({ unit }) => {
        const level = levels[unit.id] ?? defaultLevel(unit, covered.get(unit.id))
        const options = endLevels(unit.level)
        return (
          <div key={unit.id} className="flex flex-col gap-3 rounded-[24px] glass p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{unitTitle(unit)}</span>
                <span className="text-xs text-ink-muted">
                  {[
                    t('time.minutes', { m: Math.round(plan.minutes.get(unit.id) ?? 0) }),
                    unit.ai_difficulty ? t('session.end.prior', { d: unit.ai_difficulty }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setLevels((l) => ({
                    ...l,
                    [unit.id]: options[(options.indexOf(level) + 1) % options.length]!,
                  }))
                }
                aria-label={t('session.end.statusChange')}
                className={cn(
                  'min-h-8 shrink-0 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
                  STATUS_CHIP[level],
                )}
              >
                {statusLabel(t, unit.kind, level)}
              </button>
            </div>
            <div
              role="group"
              aria-label={t('session.end.difficultyScale')}
              className="flex gap-1.5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={ratings[unit.id] === n}
                  aria-label={t('session.end.difficultyN', { n })}
                  onClick={() =>
                    setRatings((r) => {
                      const next = { ...r }
                      if (next[unit.id] === n) delete next[unit.id]
                      else next[unit.id] = n
                      return next
                    })
                  }
                  className={cn(
                    'h-11 flex-1 rounded-[14px] text-base font-semibold',
                    ratings[unit.id] === n ? 'bg-ink text-white' : 'bg-white/50 text-ink',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-ink-muted">
              <span>{t('session.end.easy')}</span>
              <span>{t('session.end.hard')}</span>
            </div>
          </div>
        )
      })}

      <h2 className="mt-1 text-lg font-semibold">{t('session.end.focus')}</h2>
      <div role="group" aria-label={t('session.end.focus')} className="flex gap-2">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={focus === n}
            onClick={() => setFocus(focus === n ? null : n)}
            className={cn(
              'h-12 flex-1 rounded-full text-sm font-semibold',
              focus === n ? 'bg-ink text-white' : 'bg-white/50 text-ink',
            )}
          >
            {t(`session.end.focusLevel.${n}`)}
          </button>
        ))}
      </div>
      {focus === 1 && (
        <>
          <span className="text-[15px] font-semibold">
            {t('session.end.whyLow')}{' '}
            <span className="font-normal text-ink-muted">{t('session.end.optional')}</span>
          </span>
          <div role="group" aria-label={t('session.end.whyLow')} className="flex flex-wrap gap-2">
            {FOCUS_REASONS.map((r) => {
              const on = reasons.includes(r)
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReasons((rs) => (on ? rs.filter((x) => x !== r) : [...rs, r]))}
                  className={cn(
                    'h-11 rounded-full px-4 text-sm font-semibold',
                    on ? 'bg-ink text-white' : 'bg-white/50 text-ink',
                  )}
                >
                  {t(`session.end.reason.${r}`)}
                </button>
              )
            })}
          </div>
        </>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold">
          {t('session.end.reflection')}{' '}
          <span className="font-normal text-ink-muted">{t('session.end.optional')}</span>
        </span>
        <textarea
          rows={3}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder={t('session.end.reflectionPlaceholder')}
          className="resize-none rounded-[20px] glass px-4 py-3.5 text-[15px] placeholder:text-ink-placeholder"
        />
      </label>

      {gate.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={busy}
            className="h-14 rounded-full btn-primary text-base font-semibold disabled:opacity-50"
          >
            {t('sessionEnd.saveAndTest')}
          </button>
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={busy}
            className="h-12 rounded-full glass text-[15px] font-semibold text-brand disabled:opacity-50"
          >
            {t('sessionEnd.saveOnly')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void save(false)}
          disabled={busy}
          className="mt-2 h-14 rounded-full btn-primary text-base font-semibold disabled:opacity-50"
        >
          {t('common.save')}
        </button>
      )}
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-[20px] glass p-3">
      <span className="text-xl font-bold">{value}</span>
      <span className="text-center text-xs text-ink-muted">{label}</span>
    </div>
  )
}

function RangeRow({
  label,
  source,
  unitId,
  page,
  onUnit,
  onPage,
}: {
  label: string
  source: SessionSource
  unitId: string
  page: number | null
  onUnit: (u: SessionSource['leaves'][number]) => void
  onPage: (p: number | null) => void
}) {
  const { t } = useTranslation()
  const unit = source.leaves.find((u) => u.id === unitId)
  const withPage = usesPages(source) && unit?.page_start != null
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-sm text-ink-muted">{label}</span>
      <select
        value={unitId}
        onChange={(e) => {
          const u = source.leaves.find((x) => x.id === e.target.value)
          if (u) onUnit(u)
        }}
        aria-label={t('session.end.unit', { label })}
        className="h-11 min-w-0 flex-1 truncate rounded-[14px] bg-canvas px-3 text-sm"
      >
        {source.leaves.map((u) => (
          <option key={u.id} value={u.id}>
            {unitTitle(u)}
          </option>
        ))}
      </select>
      {withPage && (
        <input
          type="number"
          inputMode="numeric"
          value={page ?? ''}
          min={unit.page_start ?? undefined}
          max={unit.page_end ?? undefined}
          onChange={(e) => onPage(e.target.value === '' ? null : Number(e.target.value))}
          aria-label={t(source.measure === 'slides' ? 'session.end.slide' : 'session.end.page', {
            label,
          })}
          className="h-11 w-[72px] shrink-0 rounded-[14px] bg-canvas px-3 text-center text-sm tabular-nums"
        />
      )}
    </div>
  )
}

/** Shows new statuses, ratings and calibration right away, also offline. */
function patchSources(queryClient: QueryClient, userId: string, subjectId: string, ops: Op[]) {
  queryClient.setQueryData<SourceWithUnits[]>(['sources', userId, subjectId], (list) =>
    list?.map((s) => {
      let next = s
      for (const op of ops) {
        if (op.kind !== 'update') continue
        if (op.table === 'sources' && op.match.id === s.id) next = { ...next, ...op.patch }
        if (op.table === 'units')
          next = {
            ...next,
            units: next.units.map((u) => (u.id === op.match.id ? { ...u, ...op.patch } : u)),
          }
      }
      return next
    }),
  )
}

import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { CloseIcon, PlusIcon } from '@/components/icons'
import { OfflineNotice } from '@/components/OfflineNotice'
import { useOnline } from '@/features/owl/api'
import { useSources } from '@/features/sources/api'
import { statusLabel, STATUS_CHIP } from '@/features/sources/format'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { useSubject } from '@/features/subjects/api'
import { localDay, toDisplayDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import type { Row } from '@/lib/sync'
import { cn } from '@/lib/utils'
import { useSession, useSessionUnits, useSessionWriter, type SessionUnitRow } from './api'
import { Chip } from './Chip'
import { reallocate, summarize } from './end'
import { findUnit, sessionSources, toEndSources, unitTitle } from './material'
import { STUDY_MODES, type ActiveSession } from './model'
import { fromDrafts, toDrafts, type SegmentDraft } from './segmentDrafts'
import { SessionHeader } from './SessionHeader'
import { useSessionUi } from './store'

/** A saved session: times per segment, units, "Uredi ocjene", delete. */
export function SessionDetailPage() {
  const { id } = useParams()
  const online = useOnline()
  const { data, isPending } = useSession(id)
  const { data: saved } = useSessionUnits(id)
  if (isPending) return null
  if (!data) return online ? <Navigate to="/sessions" replace /> : <OfflineNotice />
  if (!data.session.ended_at) return <Navigate to="/session" replace />
  return <Detail key={data.session.updated_at} data={data} saved={saved ?? []} />
}

function Detail({ data, saved }: { data: ActiveSession; saved: SessionUnitRow[] }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const boundary = useDayBoundary()
  const writer = useSessionWriter()
  const needsRecalibration = useSessionUi((s) => s.needsRecalibration)
  const { session, segments } = data
  const { data: subject } = useSubject(session.subject_id)
  const { data: sourceRows } = useSources(session.subject_id)
  const sources = sessionSources(sourceRows ?? [])
  const day = localDay(new Date(session.started_at), boundary)
  const [drafts, setDrafts] = useState<SegmentDraft[]>(() => toDrafts(segments, boundary.timeZone))
  const [dirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const summary = summarize(session, segments, new Date(session.ended_at!))
  const result = fromDrafts(drafts, day, boundary.timeZone, session.id, segments)

  const edit = (i: number, patch: Partial<SegmentDraft>) => {
    setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)))
    setDirty(true)
  }

  const save = async () => {
    if (!('segments' in result)) return
    const next = result.segments
    const removed = segments.filter((s) => !next.some((n) => n.id === s.id)).map((s) => s.id)
    const end = new Date(
      next.reduce((m, x) => (x.ended_at! > m ? x.ended_at! : m), next[0]!.ended_at!),
    )
    const minutes = reallocate(next, toEndSources(sources), saved, end)
    const units: Row[] = saved.map((r) => ({
      ...r,
      minutes: Math.round((minutes.get(r.unit_id) ?? 0) * 100) / 100,
    }))
    await writer.saveSegments(session, next, removed, units)
    if (session.origin === 'timer') needsRecalibration(session.subject_id)
    setDirty(false)
  }

  const remove = async () => {
    await writer.remove(session)
    if (session.origin === 'timer') needsRecalibration(session.subject_id)
    navigate('/sessions', { replace: true })
  }

  const errorText =
    'error' in result && dirty ? t(`session.history.segmentError.${result.error}`) : null

  return (
    <div className="flex flex-col gap-4">
      <SessionHeader
        title={subject?.name ?? t('session.title')}
        subtitle={format(toDisplayDate(day), 'EEEE, d. MMMM', { locale: dateFnsLocales[locale] })}
        fallback="/sessions"
      />

      <div className="grid grid-cols-3 gap-2">
        <Stat value={String(Math.round(summary.activeMin))} label={t('session.end.min')} />
        <Stat
          value={String(summary.pauses)}
          label={t('session.history.pauses', { count: summary.pauses })}
        />
        <Stat
          value={String(saved.length)}
          label={t('session.history.units', { count: saved.length })}
        />
      </div>
      {session.origin === 'manual' && (
        <span className="rounded-[18px] bg-canvas-soft px-4 py-3 text-xs leading-[1.45] text-ink-muted">
          {t('session.history.manualHint')}
        </span>
      )}

      <div role="group" aria-label={t('session.mode.label')} className="flex flex-wrap gap-2">
        {STUDY_MODES.map((m) => (
          <Chip
            key={m}
            tone="brand"
            selected={session.mode === m}
            onClick={() => {
              void writer.update(data, { mode: m }).then(() => {
                if (session.origin === 'timer') needsRecalibration(session.subject_id)
              })
            }}
          >
            {t(`session.mode.${m}`)}
          </Chip>
        ))}
      </div>

      <h2 className="mt-1 text-lg font-semibold">{t('session.history.segments')}</h2>
      <div className="flex flex-col gap-2 rounded-[24px] glass p-3">
        {drafts.map((d, i) => (
          <div key={d.id} className="flex flex-col gap-2 rounded-[18px] bg-canvas p-2.5">
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={d.start}
                onChange={(e) => edit(i, { start: e.target.value })}
                aria-label={t('session.history.from')}
                className="h-11 min-w-0 flex-1 rounded-[14px] glass px-3 text-[15px] tabular-nums"
              />
              <span className="text-ink-muted">–</span>
              <input
                type="time"
                value={d.end}
                onChange={(e) => edit(i, { end: e.target.value })}
                aria-label={t('session.history.to')}
                className="h-11 min-w-0 flex-1 rounded-[14px] glass px-3 text-[15px] tabular-nums"
              />
              <button
                type="button"
                onClick={() => {
                  setDrafts((x) => x.filter((_, j) => j !== i))
                  setDirty(true)
                }}
                aria-label={t('session.history.removeSegment')}
                className="flex size-11 shrink-0 items-center justify-center rounded-full glass text-ink-muted"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <select
              value={d.unitId ?? ''}
              onChange={(e) => edit(i, { unitId: e.target.value || null })}
              aria-label={t('session.start.unit')}
              className="h-11 rounded-[14px] glass px-3 text-sm"
            >
              <option value="">{t('session.units.none')}</option>
              {sources.map((s) => (
                <optgroup key={s.source.id} label={s.source.title}>
                  {s.leaves.map((u) => (
                    <option key={u.id} value={u.id}>
                      {unitTitle(u)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const last = drafts.at(-1)
            const start = last?.end ?? '12:00'
            const [h, m] = start.split(':').map(Number)
            const endMin = (((h! * 60 + m! + 25) % 1440) + 1440) % 1440
            const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
            setDrafts((x) => [
              ...x,
              { id: crypto.randomUUID(), unitId: last?.unitId ?? null, start, end },
            ])
            setDirty(true)
          }}
          className="flex h-11 items-center justify-center gap-1.5 rounded-[18px] text-sm font-semibold text-brand"
        >
          <PlusIcon size={16} />
          {t('session.history.addSegment')}
        </button>
        {errorText && <span className="px-1 text-xs text-warning">{errorText}</span>}
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={!('segments' in result)}
            className="h-12 rounded-full btn-primary text-[15px] font-semibold disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        )}
      </div>

      <div className="mt-1 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{t('session.history.studied')}</h2>
        <Link
          to={`/session/${session.id}/end?from=history`}
          className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
        >
          {t('session.history.editEnd')}
        </Link>
      </div>
      {saved.length === 0 ? (
        <span className="text-sm text-ink-muted">{t('session.history.noUnits')}</span>
      ) : (
        <div className="flex flex-col gap-0.5 rounded-[24px] glass p-1.5">
          {saved.map((r) => {
            const found = findUnit(sources, r.unit_id)
            const level = r.level_after ?? 0
            return (
              <div key={r.unit_id} className="flex items-center gap-3 rounded-[18px] p-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">
                    {found ? unitTitle(found.unit) : '—'}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {[
                      t('time.minutes', { m: Math.round(Number(r.minutes)) }),
                      found && Number(r.amount_done ?? 0) > 0
                        ? `${Number(r.amount_done)} ${t(
                            `session.end.amount.${found.source.measure}`,
                            {
                              count: Number(r.amount_done),
                            },
                          )}`
                        : null,
                      r.difficulty ? t('session.end.difficultyN', { n: r.difficulty }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {found && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                      STATUS_CHIP[level],
                    )}
                  >
                    {statusLabel(t, found.unit.kind, level)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(session.focus || session.reflection) && (
        <div className="flex flex-col gap-1 rounded-[24px] glass p-4 text-sm">
          {session.focus && (
            <span>
              <span className="text-ink-muted">{t('session.end.focus')} </span>
              <span className="font-semibold">
                {t(`session.end.focusLevel.${session.focus as 1 | 2 | 3}`)}
              </span>
            </span>
          )}
          {session.reflection && <span className="leading-[1.45]">{session.reflection}</span>}
        </div>
      )}

      {confirm ? (
        <div className="flex flex-col gap-2 rounded-[20px] bg-warning-soft p-4">
          <span className="text-sm text-warning-ink">{t('session.history.deleteConfirm')}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="h-11 flex-1 rounded-full glass text-sm font-semibold"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={remove}
              className="h-11 flex-1 rounded-full bg-warning text-sm font-semibold text-white"
            >
              {t('session.history.delete')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="h-12 rounded-full glass text-[15px] font-semibold text-warning"
        >
          {t('session.history.delete')}
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

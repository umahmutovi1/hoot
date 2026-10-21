import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { BottomSheet } from '@/components/BottomSheet'
import { EmptyCard } from '@/components/EmptyCard'
import { PlusIcon } from '@/components/icons'
import { useDayBoundary } from '@/features/settings/profile'
import { useLocale } from '@/features/settings/useLocale'
import { paletteOf } from '@/features/subjects/colors'
import { useSubjects } from '@/features/subjects/api'
import { localDay, toDisplayDate, zonedInstant, type LocalDate } from '@/lib/day'
import { dateFnsLocales } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useSessions, useSessionWriter, type SessionListItem } from './api'
import { Chip } from './Chip'
import { sessionMinutes, STUDY_MODES } from './model'
import { hhmm } from './segmentDrafts'
import { SessionHeader } from './SessionHeader'
import { useNow } from './useNow'
import type { StudyMode } from '@/lib/estimates/calibration'

/** History of finished sessions by day, filtered by subject; "+ Dodaj sesiju" adds one afterwards. */
export function SessionsPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [params, setParams] = useSearchParams()
  const subjectId = params.get('subject')
  const boundary = useDayBoundary()
  const { data: sessions, isPending } = useSessions()
  const { data: subjects } = useSubjects()
  const [adding, setAdding] = useState(false)

  const list = (sessions ?? []).filter((s) => !subjectId || s.subject_id === subjectId)
  const days = new Map<LocalDate, SessionListItem[]>()
  for (const s of list) {
    const day = localDay(new Date(s.started_at), boundary)
    days.set(day, [...(days.get(day) ?? []), s])
  }
  const usedSubjects = (subjects ?? []).filter(
    (x) => !x.archived || (sessions ?? []).some((s) => s.subject_id === x.id),
  )

  return (
    <div className="flex flex-col gap-4">
      <SessionHeader
        title={t('session.history.title')}
        fallback="/progress"
        action={
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={t('session.history.add')}
            className="flex size-11 shrink-0 items-center justify-center rounded-full glass text-brand"
          >
            <PlusIcon size={20} />
          </button>
        }
      />

      {usedSubjects.length > 1 && (
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
          <Chip selected={!subjectId} onClick={() => setParams({}, { replace: true })}>
            {t('session.history.all')}
          </Chip>
          {usedSubjects.map((x) => (
            <Chip
              key={x.id}
              selected={x.id === subjectId}
              onClick={() => setParams({ subject: x.id }, { replace: true })}
            >
              <span className="whitespace-nowrap">{x.name}</span>
            </Chip>
          ))}
        </div>
      )}

      {!isPending && list.length === 0 && (
        <EmptyCard title={t('session.history.emptyTitle')}>{t('session.history.empty')}</EmptyCard>
      )}

      {[...days].map(([day, items]) => (
        <section key={day} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[15px] font-semibold first-letter:uppercase">
              {format(toDisplayDate(day), 'EEEE, d. MMMM', { locale: dateFnsLocales[locale] })}
            </h2>
            <span className="text-xs text-ink-muted">
              {t('time.minutes', {
                m: Math.round(items.reduce((sum, s) => sum + sessionMinutes(s), 0)),
              })}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-[24px] glass p-1.5">
            {items.map((s) => {
              const subject = subjects?.find((x) => x.id === s.subject_id)
              return (
                <Link
                  key={s.id}
                  to={`/sessions/${s.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-[18px] p-3"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-9 w-1.5 shrink-0 rounded-full',
                      paletteOf(subject?.color ?? null).bar,
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">{subject?.name}</span>
                    <span className="text-xs text-ink-muted">
                      {[
                        `${hhmm(new Date(s.started_at), boundary.timeZone)}–${hhmm(new Date(s.ended_at!), boundary.timeZone)}`,
                        s.mode ? t(`session.mode.${s.mode}`) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {s.origin === 'manual' && (
                    <span className="rounded-lg bg-canvas px-2 py-1 text-[11px] font-semibold text-ink-muted">
                      {t('session.history.manual')}
                    </span>
                  )}
                  <span className="text-[13px] font-semibold text-brand">
                    {t('time.minutes', { m: Math.round(sessionMinutes(s)) })}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}

      <AddSessionSheet open={adding} onOpenChange={setAdding} subjectId={subjectId} />
    </div>
  )
}

/** "+ Dodaj sesiju": studied without the timer. Next comes the end-of-session form. */
function AddSessionSheet({
  open,
  onOpenChange,
  subjectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjectId: string | null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const boundary = useDayBoundary()
  const writer = useSessionWriter()
  const { data: subjects } = useSubjects()
  const active = (subjects ?? []).filter((s) => !s.archived)
  const [subject, setSubject] = useState<string | null>(subjectId)
  const now = useNow(60_000, open)
  const [today] = useState(() => new Date())
  const [date, setDate] = useState(() => localDay(today, boundary))
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [mode, setMode] = useState<StudyMode | null>('reading')
  const [busy, setBusy] = useState(false)

  const minutesOf = (x: string) => {
    const m = /^(\d{2}):(\d{2})$/.exec(x)
    return m ? Number(m[1]) * 60 + Number(m[2]) : null
  }
  const a = minutesOf(from)
  let b = minutesOf(to)
  if (a !== null && b !== null && b <= a) b += 1440
  const start = a === null ? null : zonedInstant(date, a, boundary.timeZone)
  const end = b === null ? null : zonedInstant(date, b, boundary.timeZone)
  const valid = Boolean(subject && start && end && end.getTime() <= now.getTime())

  const next = async () => {
    if (!valid || busy) return
    setBusy(true)
    const id = await writer.addManual({ subjectId: subject!, mode, start: start!, end: end! })
    onOpenChange(false)
    setBusy(false)
    navigate(`/session/${id}/end?from=history`)
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('session.history.addTitle')}
      subtitle={t('session.history.addSubtitle')}
    >
      <div className="flex flex-wrap gap-1.5" aria-label={t('session.start.subject')}>
        {active.map((s) => (
          <Chip key={s.id} selected={s.id === subject} onClick={() => setSubject(s.id)}>
            {s.name}
          </Chip>
        ))}
      </div>
      <label className="flex items-center justify-between gap-3 text-[15px] font-semibold">
        {t('session.history.date')}
        <input
          type="date"
          value={date}
          max={localDay(today, boundary)}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-11 rounded-[14px] bg-canvas px-3 text-[15px]"
        />
      </label>
      <div className="flex items-center gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
          {t('session.history.from')}
          <input
            type="time"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-11 rounded-[14px] bg-canvas px-3 text-[15px]"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
          {t('session.history.to')}
          <input
            type="time"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-11 rounded-[14px] bg-canvas px-3 text-[15px]"
          />
        </label>
      </div>
      <div role="group" aria-label={t('session.mode.label')} className="flex flex-wrap gap-2">
        {STUDY_MODES.map((m) => (
          <Chip
            key={m}
            tone="brand"
            selected={mode === m}
            onClick={() => setMode(mode === m ? null : m)}
          >
            {t(`session.mode.${m}`)}
          </Chip>
        ))}
      </div>
      <span className="text-xs leading-[1.45] text-ink-muted">
        {t('session.history.manualHint')}
      </span>
      <button
        type="button"
        onClick={next}
        disabled={!valid || busy}
        className="h-14 rounded-full btn-primary text-base font-semibold disabled:opacity-50"
      >
        {t('session.history.next')}
      </button>
    </BottomSheet>
  )
}

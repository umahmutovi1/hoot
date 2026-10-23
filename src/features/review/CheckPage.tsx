import type { TFunction } from 'i18next'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckIcon, CloseIcon } from '@/components/icons'
import { LazyMarkdown } from '@/components/LazyMarkdown'
import { SplashScreen } from '@/components/SplashScreen'
import { useAllSources, useTopicLinks } from '@/features/plan/api'
import { useActiveSession, useSessionWriter } from '@/features/session/api'
import type { ActiveSession } from '@/features/session/model'
import { toSegment } from '@/features/session/model'
import { useSessionUi } from '@/features/session/store'
import { useDayBoundary } from '@/features/settings/profile'
import type { Card, SourceWithUnits } from '@/features/sources/model'
import { useSubjects } from '@/features/subjects/api'
import { paletteOf } from '@/features/subjects/colors'
import { diffDays, localDay, type LocalDate } from '@/lib/day'
import { activeMs, MINUTE } from '@/lib/session/timer'
import { strengthBand, type Recall } from '@/lib/srs'
import type { Op } from '@/lib/sync'
import { cn } from '@/lib/utils'
import { useCardsOf, useReviewWriter } from './api'
import { BAND_BG } from './bands'
import { checkItems, checkReviews, checkSummary, type CheckItem, type CheckSummary } from './check'
import { linkedQuestions } from './gate'
import { RateButtons } from './RateButtons'
import { strengthOf } from './strength'

/**
 * Provjera znanja (ProvjeraZnanja → ProvjeraSazetak mockups): the units of a review block (or of
 * the checks due) one after another as recall gates, then the change in strength. The session's
 * timer runs meanwhile, so the block counts as studied like any other.
 */
export function CheckPage() {
  const { data: active, isPending } = useActiveSession()
  const check = useSessionUi((s) => s.check)
  const { data: sources } = useAllSources()
  const { data: links } = useTopicLinks()
  const unitIds = check?.unitIds ?? []
  const { data: cards, isPending: cardsPending } = useCardsOf(unitIds)
  const [summary, setSummary] = useState<(CheckSummary & { minutes: number }) | null>(null)
  // Ending the session clears it before the summary is ready: no redirect meanwhile.
  const [finishing, setFinishing] = useState(false)

  if (summary) return <Summary summary={summary} />
  if (finishing && !active) return <SplashScreen />
  if (isPending || !sources || !links || (unitIds.length > 0 && cardsPending))
    return <SplashScreen />
  if (!active || !check || check.sessionId !== active.session.id) return <Navigate to="/" replace />
  return (
    <Quiz
      active={active}
      unitIds={unitIds}
      sources={sources}
      links={links}
      cards={cards ?? []}
      onFinishing={() => setFinishing(true)}
      onDone={setSummary}
    />
  )
}

function Quiz({
  active,
  unitIds,
  sources,
  links,
  cards,
  onFinishing,
  onDone,
}: {
  active: ActiveSession
  unitIds: string[]
  sources: SourceWithUnits[]
  links: { unit_id: string; topic_id: string }[]
  cards: Card[]
  onFinishing: () => void
  onDone: (s: CheckSummary & { minutes: number }) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const boundary = useDayBoundary()
  const writer = useReviewWriter()
  const sessionWriter = useSessionWriter()
  const setCheck = useSessionUi((s) => s.setCheck)
  const { data: subjects = [] } = useSubjects()
  const [at, setAt] = useState(0)
  const [ratings, setRatings] = useState<Record<string, Recall>>({})
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const today = localDay(new Date(active.session.started_at), boundary)
  const all = sources.flatMap((s) => s.units)
  const subjectOf = new Map(sources.flatMap((s) => s.units.map((u) => [u.id, s.subject_id])))
  const units = unitIds.flatMap((id) => all.filter((u) => u.id === id))
  const items = checkItems(
    units,
    cards,
    (u) =>
      linkedQuestions(
        { key: u.id, title: u.title, label: u.label, leaves: [u] },
        links,
        all.filter((x) => subjectOf.get(x.id) === subjectOf.get(u.id)),
      ),
    today,
  )
  const item = items[Math.min(at, items.length - 1)]

  const finish = async (final: Record<string, Recall>) => {
    if (busy) return
    setBusy(true)
    const rated = Object.keys(final).length > 0
    if (!rated) {
      await sessionWriter.discard(active)
      setCheck(null)
      navigate('/', { replace: true })
      return
    }
    onFinishing()
    const reviews = checkReviews(items, final)
    const outcomes = await writer.save(reviews.units, reviews.cards)
    const end = new Date()
    const minutes = activeMs(active.segments.map(toSegment), end) / MINUTE
    await sessionWriter.finish(active, end)
    const reviewed = [
      ...new Set(reviews.units.map((r) => r.unit.id).filter((id) => unitIds.includes(id))),
    ]
    if (reviewed.length > 0)
      await writer.write([
        {
          kind: 'upsert',
          table: 'session_units',
          onConflict: 'session_id,unit_id',
          rows: reviewed.map((id) => {
            const o = outcomes.find((x) => x.kind === 'unit' && x.id === id)
            return {
              session_id: active.session.id,
              unit_id: id,
              minutes: Math.round((minutes / reviewed.length) * 100) / 100,
              amount_done: null,
              level_before: o?.levelBefore ?? null,
              level_after: o?.levelAfter ?? null,
              difficulty: null,
            }
          }),
        } satisfies Op,
      ])
    setCheck(null)
    onDone({ ...checkSummary(items, final, outcomes, today), minutes: Math.round(minutes) })
  }

  if (!item)
    return (
      <div className="flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-ink-secondary">{t('review.empty')}</p>
        <button
          type="button"
          onClick={() => void finish({})}
          className="h-12 rounded-full btn-primary px-6 font-semibold"
        >
          {t('review.toToday')}
        </button>
      </div>
    )

  const subject = subjects.find((s) => s.id === subjectOf.get(item.unit.id))
  const palette = paletteOf(subject?.color ?? null)
  const rate = (r: Recall) => {
    const next = { ...ratings, [item.key]: r }
    setRatings(next)
    if (at >= items.length - 1) void finish(next)
    else setAt(at + 1)
  }

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col gap-4 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void finish(ratings)}
          aria-label={t('review.close')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full glass"
        >
          <CloseIcon size={20} />
        </button>
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-secondary">
            {t('review.progress', { n: at + 1, total: items.length })}
          </span>
          <div className="h-1.5 rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand-accent"
              style={{ width: `${Math.round(((at + 1) / items.length) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {subject && (
        <span
          className={cn(
            'self-start rounded-full px-3 py-1 text-xs font-semibold',
            palette.soft,
            palette.inkText,
          )}
        >
          {subject.name}
        </span>
      )}
      <UnitLine item={item} cards={cards} today={today} />

      <div className="flex flex-col gap-3.5 rounded-card-lg glass p-5">
        <span className="text-xs font-semibold text-brand-muted">{sourceLabel(t, item)}</span>
        <p className="text-[19px] leading-[1.35] font-semibold">
          {item.source === 'notes' || item.source === 'recall'
            ? t('review.recallPrompt', { title: item.prompt })
            : item.prompt}
        </p>
        <textarea
          key={item.key}
          rows={3}
          aria-label={t('recall.answerAria')}
          placeholder={t('recall.answerPlaceholder')}
          className="resize-none rounded-input bg-white/40 p-3.5 text-[15px] placeholder:text-ink-placeholder"
        />
        {revealed.has(item.key) ? (
          <div className="flex flex-col gap-1 rounded-input bg-success-soft p-3.5">
            <span className="text-xs font-semibold text-subject-green-deep">
              {t('review.answer')}
            </span>
            {item.answer ? (
              <div className="text-[15px] leading-[1.4]">
                <LazyMarkdown>{item.answer}</LazyMarkdown>
              </div>
            ) : (
              <span className="text-[15px] leading-[1.4]">{t('review.noAnswer')}</span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed((s) => new Set(s).add(item.key))}
            className="h-12 rounded-full border-2 border-brand glass text-[15px] font-semibold text-brand"
          >
            {t('recall.reveal')}
          </button>
        )}
      </div>

      <RateButtons
        labels="review"
        value={ratings[item.key] ?? null}
        disabled={!revealed.has(item.key) || busy}
        onPick={rate}
      />
    </div>
  )
}

function sourceLabel(t: TFunction, item: CheckItem) {
  if (item.source === 'exam_question')
    return t('review.src.exam_question', { label: item.question?.label ?? '' })
  return t(`review.src.${item.source}`)
}

function UnitLine({ item, cards, today }: { item: CheckItem; cards: Card[]; today: LocalDate }) {
  const { t } = useTranslation()
  const boundary = useDayBoundary()
  const r = strengthOf(
    item.unit,
    cards.filter((c) => c.unit_id === item.unit.id),
    today,
    boundary,
  )
  const lastOn = item.unit.last_review_at
    ? localDay(new Date(item.unit.last_review_at), boundary)
    : null
  const ago = lastOn === null ? null : diffDays(lastOn, today)
  const last =
    ago === null
      ? null
      : ago === 0
        ? t('review.last.today')
        : ago === 1
          ? t('review.last.yesterday')
          : t('review.last.ago', { count: ago })
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[22px] leading-tight font-bold">
        {[item.unit.label, item.unit.title].filter(Boolean).join(' ')}
      </span>
      <div className="flex items-center gap-2">
        {r !== null && (
          <div className="h-1.5 w-16 rounded-full bg-line">
            <div
              className={cn('h-full rounded-full', BAND_BG[strengthBand(r)])}
              style={{ width: `${Math.round(r * 100)}%` }}
            />
          </div>
        )}
        <span className="text-xs text-ink-muted">
          {r !== null && last
            ? t('review.strength', { pct: `${Math.round(r * 100)}%`, last })
            : t('review.firstCheck')}
        </span>
      </div>
    </div>
  )
}

function Summary({ summary }: { summary: CheckSummary & { minutes: number } }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: sources = [] } = useAllSources()
  const { data: subjects = [] } = useSubjects()
  const subjectName = (unitId: string) => {
    const s = sources.find((x) => x.units.some((u) => u.id === unitId))
    return subjects.find((x) => x.id === s?.subject_id)?.name ?? ''
  }
  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col gap-4 pt-[env(safe-area-inset-top)]">
      <div className="flex flex-col items-center gap-2.5 pt-4">
        <span
          role="img"
          aria-label={t('review.finishedAria')}
          className="icon-tile flex size-16 items-center justify-center rounded-[20px]"
        >
          <CheckIcon size={30} />
        </span>
        <h1 className="text-[26px] font-bold">
          {t('review.summaryTitle', { count: summary.count })}
        </h1>
        <span className="text-center text-sm text-ink-muted">
          {t('review.summaryLine', {
            yes: summary.remembered,
            part: summary.partly,
            no: summary.forgot,
            min: summary.minutes,
          })}
        </span>
      </div>
      <div className="flex flex-col rounded-card glass px-4">
        {summary.changes.map((c) => {
          // A band and when the next check comes read clearer than two percentages (a test
          // repeated the same day would even show a "drop" from 100% to tomorrow's value).
          const band = strengthBand(c.after)
          return (
            <div
              key={c.unit.id}
              className="flex items-center gap-2 border-t border-hairline py-3 first:border-t-0"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">
                  {[c.unit.label, c.unit.title].filter(Boolean).join(' ')}
                </span>
                <span className="truncate text-xs text-ink-muted">
                  {[
                    subjectName(c.unit.id),
                    c.nextInDays !== null
                      ? t('review.nextFor', { count: c.nextInDays })
                      : t('review.relearnSub'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                  c.relearn
                    ? 'bg-warning-soft text-warning-muted'
                    : band === 'strong'
                      ? 'bg-success-soft text-success-ink'
                      : band === 'good'
                        ? 'bg-strength-good-soft text-strength-good-ink'
                        : 'bg-warning-soft text-warning-muted',
                )}
              >
                {c.relearn ? t('review.relearn') : t(`strength.band.${band}`)}
              </span>
            </div>
          )
        })}
      </div>
      {summary.relearn.length > 0 && (
        <span className="text-center text-sm text-ink-secondary">
          {t('review.relearnNote', { units: summary.relearn.map((u) => u.title).join(', ') })}
        </span>
      )}
      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        className="mt-auto h-14 rounded-full btn-primary text-base font-semibold"
      >
        {t('review.done')}
      </button>
    </div>
  )
}

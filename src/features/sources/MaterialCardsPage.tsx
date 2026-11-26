import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { CardSource, MaterialCard } from '@shared/schemas.ts'
import { LazyMarkdown } from '@/components/LazyMarkdown'
import { PencilIcon, SparkleIcon } from '@/components/icons'
import { ScreenTitle } from '@/components/ScreenTitle'
import { DetailSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/toast-store'
import { AiCallError, useAiAvailability } from '@/features/owl/api'
import { useNow } from '@/features/session/useNow'
import { useDayBoundary } from '@/features/settings/profile'
import { addDays, localDay } from '@/lib/day'
import { cn } from '@/lib/utils'
import { useSource } from './api'
import { useAddMaterialCards, useProposeCards, useUnitsWithText } from './summaryApi'
import { PageChip } from './SummaryView'

interface Draft extends MaterialCard {
  dropped: boolean
  editing: boolean
}

/**
 * Kartice iz gradiva (board "Jedinica · kartice iz gradiva"): the AI proposes 5–15 cards from the
 * unit's text, its notes or pasted text; each is kept, edited or dropped, and the kept ones become
 * the unit's FSRS cards with the first review tomorrow.
 */
export function MaterialCardsPage() {
  const { id, sourceId, unitId } = useParams()
  const { data: source, isPending } = useSource(id, sourceId)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast((s) => s.success)
  const { state, canPrivate } = useAiAvailability()
  const withText = useUnitsWithText().data
  const propose = useProposeCards()
  const add = useAddMaterialCards()
  const boundary = useDayBoundary()
  const now = useNow(60_000)
  const unit = source?.units.find((u) => u.id === unitId)
  const family =
    source && unit ? [unit, ...source.units.filter((u) => u.parent_id === unit.id)] : []
  const hasText = family.some((u) => withText?.has(u.id))
  const hasNotes = family.some((u) => u.notes?.trim())
  const [from, setFrom] = useState<CardSource | null>(null)
  const [pasted, setPasted] = useState('')
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  if (isPending) return <DetailSkeleton />
  if (!source || !unit) return <Navigate to={`/subjects/${id}`} replace />

  const chosen: CardSource = from ?? (hasText ? 'text' : hasNotes ? 'notes' : 'pasted')
  const kept = drafts?.filter((d) => !d.dropped && d.front.trim() && d.back.trim()) ?? []
  const error = propose.error
    ? propose.error instanceof AiCallError
      ? propose.error.code
      : 'failed'
    : null
  const patch = (i: number, p: Partial<Draft>) =>
    setDrafts((list) => list?.map((d, j) => (j === i ? { ...d, ...p } : d)) ?? null)

  const run = () =>
    propose.mutate(
      { unitId: unit.id, from: chosen, ...(chosen === 'pasted' ? { text: pasted.trim() } : {}) },
      {
        onSuccess: (cards) =>
          setDrafts(cards.map((c) => ({ ...c, dropped: false, editing: false }))),
      },
    )

  const save = () =>
    add.mutate(
      {
        unitId: unit.id,
        cards: kept.map((d) => ({ front: d.front.trim(), back: d.back.trim() })),
        firstReview: addDays(localDay(now, boundary), 1),
      },
      {
        onSuccess: (n) => {
          toast(t('materialCards.added', { count: n }))
          navigate(`/subjects/${id}/sources/${source.id}/units/${unit.id}`)
        },
      },
    )

  const canRun =
    state === 'ready' &&
    canPrivate &&
    !propose.isPending &&
    (chosen !== 'pasted' || pasted.trim().length > 0) &&
    (chosen !== 'notes' || hasNotes)

  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle
        title={t('materialCards.title')}
        sub={t('materialCards.sub', { unit: unit.title })}
      />
      <div role="radiogroup" aria-label={t('materialCards.from')} className="flex flex-wrap gap-2">
        {(['text', 'notes', 'pasted'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={chosen === s}
            disabled={(s === 'text' && !hasText) || (s === 'notes' && !hasNotes)}
            onClick={() => {
              setFrom(s)
              setDrafts(null)
            }}
            className={cn(
              'h-11 rounded-[14px] px-4 text-sm font-bold disabled:opacity-40',
              chosen === s ? 'bg-brand text-ground' : 'surface text-ink',
            )}
          >
            {t(`materialCards.sources.${s}`)}
          </button>
        ))}
      </div>
      {chosen === 'pasted' && !drafts && (
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          maxLength={12000}
          rows={8}
          placeholder={t('materialCards.pastePlaceholder')}
          className="rounded-[18px] bg-raised p-4 text-base shadow-[inset_0_0_0_1.5px_var(--color-hairline)] outline-none"
        />
      )}

      {!canPrivate && state === 'ready' ? (
        <p className="surface rounded-card px-4 py-3.5 text-sm text-ink-secondary">
          {t('owl.error.needs_paid')}
        </p>
      ) : !drafts ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={!canRun}
            onClick={run}
            className="btn-primary flex h-14 items-center justify-center gap-2.5 rounded-[16px] text-[17px] font-bold disabled:opacity-60"
          >
            <SparkleIcon size={18} />
            {propose.isPending ? t('materialCards.proposing') : t('materialCards.propose')}
          </button>
          <span className="px-1 text-center text-[13px] text-ink-muted">
            {t('materialCards.range')}
          </span>
          {error && (
            <span role="alert" className="px-1 text-sm text-danger">
              {t(`owl.error.${error as 'failed'}`)}
            </span>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between px-1">
            <span className="text-base font-bold tabular-nums">
              {t('materialCards.kept', { kept: kept.length, total: drafts.length })}
            </span>
            <span className="text-[13px] text-ink-muted">{t('materialCards.range')}</span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {drafts.map((d, i) => (
              <li
                key={i}
                className={cn(
                  'flex flex-col gap-2 rounded-[22px] px-4 py-3.5 transition-opacity duration-200 motion-reduce:transition-none',
                  d.dropped ? 'surface opacity-45' : 'bg-raised',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <PageChip page={d.page} />
                  <span
                    className={cn(
                      'ml-auto flex h-6 items-center rounded-lg px-2 text-xs font-bold',
                      d.dropped ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success-ink',
                    )}
                  >
                    {d.dropped ? t('materialCards.dropped') : t('materialCards.keep')}
                  </span>
                </div>
                {d.editing ? (
                  <>
                    <input
                      aria-label={t('materialCards.front')}
                      value={d.front}
                      onChange={(e) => patch(i, { front: e.target.value })}
                      className="h-12 rounded-input bg-canvas px-4 text-base font-bold outline-none"
                    />
                    <textarea
                      aria-label={t('materialCards.back')}
                      value={d.back}
                      rows={3}
                      onChange={(e) => patch(i, { back: e.target.value })}
                      className="rounded-input bg-canvas p-3 text-[15px] outline-none"
                    />
                  </>
                ) : (
                  <>
                    <div className="font-bold [&_.markdown]:text-base [&_.markdown]:leading-[22px]">
                      <LazyMarkdown>{d.front}</LazyMarkdown>
                    </div>
                    <div className="text-ink-secondary [&_.markdown]:text-[15px] [&_.markdown]:leading-[22px]">
                      <LazyMarkdown>{d.back}</LazyMarkdown>
                    </div>
                  </>
                )}
                <div className="mt-0.5 flex gap-2">
                  <button
                    type="button"
                    aria-pressed={d.dropped}
                    onClick={() => patch(i, { dropped: !d.dropped, editing: false })}
                    className={cn(
                      'h-11 rounded-[14px] px-4 text-sm font-bold',
                      d.dropped ? 'bg-brand text-ground' : 'surface text-ink',
                    )}
                  >
                    {d.dropped ? t('materialCards.restore') : t('materialCards.drop')}
                  </button>
                  {!d.dropped && (
                    <button
                      type="button"
                      aria-label={t('materialCards.edit')}
                      aria-pressed={d.editing}
                      onClick={() => patch(i, { editing: !d.editing })}
                      className="flex size-11 items-center justify-center text-brand-strong"
                    >
                      <PencilIcon size={20} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="sticky bottom-[calc(16px+var(--nav-offset,0px)+env(safe-area-inset-bottom))] z-10 -mx-5 mt-2 flex flex-col gap-1 bg-ground px-5 pt-3">
            <button
              type="button"
              disabled={kept.length === 0 || add.isPending}
              onClick={save}
              className="btn-primary h-14 rounded-[16px] text-[17px] font-bold disabled:opacity-60"
            >
              {t('materialCards.add', { count: kept.length })}
            </button>
            <span className="text-center text-[13px] text-ink-secondary">
              {t('materialCards.addHint')}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

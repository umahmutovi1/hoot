import { format } from 'date-fns'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ChevronDownIcon, CheckIcon, UndoIcon } from '@/components/icons'
import { ScreenTitle } from '@/components/ScreenTitle'
import { useAiAvailability } from '@/features/owl/api'
import { ProgressProvider, useProgress } from '@/features/progress/useProgress'
import { useLocale } from '@/features/settings/useLocale'
import { formatDuration } from '@/features/sources/format'
import { paletteOf } from '@/features/subjects/colors'
import { diffDays, toDisplayDate, weekdayOf } from '@/lib/day'
import { dateFnsLocales, type Locale } from '@/lib/locale'
import { formatClock } from '@/lib/schedule'
import { actionLabel, insightCopy } from './copy'
import { confirmTargets, summaryOf, type ShownSuggestion, type Suggestion } from './suggestions'
import { useProposals } from './useProposals'

/** Shown before "Još N prijedloga" (board Prijedlozi). */
const TOP = 3

export function ProposalsPage() {
  return (
    <ProgressProvider>
      <Proposals />
    </ProgressProvider>
  )
}

function Proposals() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const data = useProgress()
  const proposals = useProposals()
  const availability = useAiAvailability()
  const [more, setMore] = useState(false)
  // A decision can drop a suggestion from the rules and bring it back from feedback: the order of
  // this visit stays, so a card never jumps.
  const [order, setOrder] = useState<string[]>([])
  const added = proposals.list.filter((s) => !order.includes(s.suggestion.id))
  if (added.length) setOrder([...order, ...added.map((s) => s.suggestion.id)])
  const { window, strategy } = proposals
  if (!data || !proposals.ready || !window)
    return <p className="text-sm text-ink-muted">{t('insights.loading')}</p>
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length)
  const all = [...proposals.list].sort((a, b) => rank(a.suggestion.id) - rank(b.suggestion.id))
  const shown = more ? all : all.slice(0, TOP)
  const hidden = all.length - TOP
  const targets = confirmTargets(shown, proposals.asksLeft)
  const summary = summaryOf(all)
  const fmt = (date: string) =>
    format(toDisplayDate(date), locale === 'en' ? 'MMM d' : 'd. MMM', {
      locale: dateFnsLocales[locale],
    })
  const range = `${fmt(window.from)} – ${fmt(window.to)}`
  const lead = t(weekdayOf(data.today) === 6 ? 'proposals.thisWeek' : 'proposals.lastWeek', {
    range,
  })
  const subjectOf = (id: string | null) => data.inputs.subjects.find((s) => s.id === id)

  return (
    <div className="flex flex-col gap-3">
      <ScreenTitle title={t('proposals.title')} sub={lead} />
      {all.length === 0 ? (
        <p className="text-sm text-ink-secondary">{t('strategist.noActions')}</p>
      ) : (
        <>
          <div className="flex min-h-11 items-center justify-between gap-3 px-1">
            <span role="status" className="text-[15px] font-bold text-brand-strong">
              {summary.pending
                ? t('proposals.pending', { count: summary.pending })
                : t('proposals.allDecided')}
              {summary.applied > 0 && ` · ${t('proposals.applied', { count: summary.applied })}`}
            </span>
            {targets.length > 1 && (
              <button
                type="button"
                disabled={proposals.busy}
                onClick={() => void proposals.approveAll(targets.map((s) => s.suggestion))}
                className="h-11 shrink-0 rounded-[14px] bg-surface px-3.5 text-sm font-bold text-brand-strong"
              >
                {t('proposals.confirm', { count: targets.length })}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            {shown.map((item, i) => (
              <ProposalCard
                key={item.suggestion.id}
                item={item}
                later={i >= TOP}
                copy={copyOf(t, locale, data.today, item.suggestion, subjectOf)}
                tone={subjectOf(item.suggestion.subjectId)?.color ?? null}
                canApprove={item.suggestion.kind === 'done' || proposals.asksLeft > 0}
                proposals={proposals}
              />
            ))}
            {hidden > 0 && (
              <button
                type="button"
                aria-expanded={more}
                onClick={() => setMore(!more)}
                className="flex h-[52px] items-center justify-center gap-2 rounded-[18px] text-[15px] font-bold text-brand-strong shadow-[inset_0_0_0_1.5px_rgb(var(--hoot-brand-rgb)/0.35)]"
              >
                {more ? t('proposals.less') : t('proposals.more', { count: hidden })}
                <ChevronDownIcon
                  size={18}
                  className={`transition-transform duration-200 motion-reduce:transition-none ${more ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>
          {proposals.asksLeft === 0 && summary.pending > 0 && (
            <p className="px-1 text-xs text-ink-muted">{t('proposals.limit')}</p>
          )}
        </>
      )}
      {proposals.error && (
        <p role="alert" className="px-1 text-xs text-danger">
          {t('strategist.applyError')}
        </p>
      )}
      <button
        type="button"
        className="mt-2 min-h-11 text-sm font-semibold text-brand"
        disabled={
          !strategy.list.length ||
          !strategy.canGenerate ||
          strategy.generate.isPending ||
          availability.state !== 'ready'
        }
        onClick={() => strategy.generate.mutate()}
      >
        {t(strategy.generate.isPending ? 'strategist.loading' : 'strategist.ask')}
      </button>
      {strategy.generate.isError && (
        <p role="status" className="px-1 text-xs text-ink-muted">
          {t('strategist.aiUnavailable')}
        </p>
      )}
    </div>
  )
}

interface CardCopy {
  tag: string
  title: string | null
  body: string
  /** The approve button of an ask. */
  action: string
  effect: string
  undone: string
  /** Name in "Preskočeno · …". */
  short: string
}

function copyOf(
  t: TFunction,
  locale: Locale,
  today: string,
  s: Suggestion,
  subjectOf: (id: string | null) => { name: string } | undefined,
): CardCopy {
  const subject = subjectOf(s.subjectId)?.name ?? ''
  const withSubject = (tag: string) => (subject ? `${subject} · ${tag}` : tag)
  if (s.from === 'replan') {
    const days = diffDays(today, s.moved.on)
    const day =
      days === 0
        ? t('proposals.today')
        : days === 1
          ? t('proposals.tomorrow')
          : format(
              toDisplayDate(s.moved.on),
              days < 7 ? 'EEEE' : locale === 'en' ? 'MMM d' : 'd. MMM',
              { locale: dateFnsLocales[locale] },
            )
    const when = s.moved.startMin === null ? day : `${day} ${formatClock(s.moved.startMin)}`
    const minutes = formatDuration(t, s.moved.minutes)
    return {
      tag: withSubject(t('proposals.alreadyDone')),
      title: t('proposals.moved.title', { minutes }),
      body: t('proposals.moved.body', { when }),
      action: t('proposals.ok'),
      effect: t('proposals.moved.effect', {
        when: when.charAt(0).toUpperCase() + when.slice(1),
        subject,
        minutes,
      }),
      undone: t('proposals.moved.undone', { subject }),
      short: withSubject(t('proposals.moved.title', { minutes })),
    }
  }
  if (s.from === 'insight') {
    const kind = t(`insights.kinds.${s.insight.kind}`)
    return {
      tag: withSubject(kind),
      title: null,
      body: insightCopy(t, s.insight, subject),
      action: s.insight.action ? actionLabel(t, s.insight.action, subject) : t('strategist.apply'),
      effect: t('proposals.appliedEffect'),
      undone: '',
      short: kind,
    }
  }
  const label = actionLabel(t, s.candidate.action, subject)
  const effect = s.candidate.effect
  return {
    tag: withSubject(t(`proposals.rules.${s.candidate.rule}`)),
    title: label,
    body:
      s.reason ??
      (effect && effect.deficitBefore !== effect.deficitAfter
        ? t('strategist.effect', { before: effect.deficitBefore, after: effect.deficitAfter })
        : ''),
    action: t('strategist.apply'),
    effect: t('proposals.appliedEffect'),
    undone: '',
    short: label,
  }
}

function ProposalCard({
  item,
  later,
  copy,
  tone,
  canApprove,
  proposals,
}: {
  item: ShownSuggestion
  later: boolean
  copy: CardCopy
  tone: string | null
  canApprove: boolean
  proposals: ReturnType<typeof useProposals>
}) {
  const { t } = useTranslation()
  const { suggestion: s, state } = item
  const palette = tone ? paletteOf(tone) : null
  const fg = palette ? palette.inkText : 'text-brand-strong'
  const fill = palette ? `${palette.inkBg} text-ground` : 'bg-brand-strong text-ground'
  const busy = proposals.busy
  const enter = later ? 'animate-settle-in' : ''
  if (state === 'declined')
    return (
      <div
        className={`flex items-center gap-2.5 rounded-[24px] border-[1.5px] border-dashed border-line py-2.5 pr-2.5 pl-[18px] ${enter}`}
      >
        <span className="min-w-0 flex-1 text-sm text-ink-secondary">
          {t('proposals.skipped', { title: copy.short })}
        </span>
        <TextButton
          className="text-brand-strong"
          disabled={busy}
          onClick={() => proposals.takeBack(s)}
        >
          {t('proposals.restore')}
        </TextButton>
      </div>
    )
  return (
    <article
      className={`flex flex-col gap-2.5 rounded-[24px] px-[18px] py-4 ${palette ? palette.soft : 'bg-surface'} ${fg} ${enter}`}
    >
      <span className="inline-flex h-6 items-center gap-1.5 self-start rounded-lg bg-raised/60 px-[9px] text-xs font-bold">
        {palette && <i className={`size-2 shrink-0 rounded-full ${palette.bar}`} />}
        {copy.tag}
      </span>
      <p className="text-base leading-[1.45]">
        {copy.title && <b>{copy.title}</b>} {copy.body}
      </p>
      {state === 'pending' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !canApprove}
            onClick={() => void proposals.approve(s)}
            className={`h-11 rounded-[14px] px-4 text-[15px] font-bold disabled:opacity-60 ${fill}`}
          >
            {copy.action}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void (s.kind === 'done' ? proposals.undo(s) : proposals.decline(s))}
            className="h-11 rounded-[14px] px-4 text-[15px] font-bold"
          >
            {t(s.kind === 'done' ? 'proposals.undo' : 'proposals.notNow')}
          </button>
        </div>
      )}
      {state === 'approved' && (
        <Result icon={<CheckIcon size={18} />} text={copy.effect}>
          <TextButton className={fg} disabled={busy} onClick={() => proposals.takeBack(s)}>
            <UndoIcon size={16} />
            {t('proposals.takeBack')}
          </TextButton>
        </Result>
      )}
      {state === 'undone' && (
        <Result icon={<UndoIcon size={18} />} text={copy.undone}>
          <TextButton className={fg} disabled={busy} onClick={() => proposals.applyAgain(s)}>
            {t('proposals.applyAgain')}
          </TextButton>
        </Result>
      )}
    </article>
  )
}

function Result({ icon, text, children }: { icon: ReactNode; text: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 animate-settle-in items-center gap-2.5 rounded-[14px] bg-raised/70 py-1 pr-1.5 pl-3">
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 text-sm leading-[1.35] font-semibold">{text}</span>
      {children}
    </div>
  )
}

/** Small text action; the hit area grows to 44 px without changing the look. */
function TextButton({
  className,
  disabled,
  onClick,
  children,
}: {
  className: string
  disabled: boolean
  onClick: () => Promise<unknown>
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onClick()}
      className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-canvas ${className}`}
    >
      {children}
    </button>
  )
}

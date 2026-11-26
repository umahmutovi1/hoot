import type { TFunction } from 'i18next'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import type { TutorVerdict } from '@shared/schemas.ts'
import { SparkleIcon } from '@/components/icons'
import { LazyMarkdown } from '@/components/LazyMarkdown'
import { ScreenTitle } from '@/components/ScreenTitle'
import { useToast } from '@/components/toast-store'
import { AiCallError } from '@/features/owl/api'
import { useReviewWriter } from '@/features/review/api'
import type { Outcome } from '@/features/review/apply'
import { checkReviews, type CheckItem } from '@/features/review/check'
import { useActiveSession } from '@/features/session/api'
import { useLocale } from '@/features/settings/useLocale'
import { formatDuration, statusLabel } from '@/features/sources/format'
import { useAddMaterialCards } from '@/features/sources/summaryApi'
import { PageChip } from '@/features/sources/SummaryView'
import { addDays, localDay, toDisplayDate } from '@/lib/day'
import { useNow } from '@/features/session/useNow'
import { useDayBoundary } from '@/features/settings/profile'
import { dateFnsLocales } from '@/lib/locale'
import { activeMs, MINUTE } from '@/lib/session/timer'
import { toSegment } from '@/features/session/model'
import type { Recall } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { useGrade, useTextQuestions } from './api'
import { OralAsk } from './OralAsk'
import { missing, textItems } from './round'
import { useTutor } from './context'
import { useRound } from './useRound'

const RECALL_OF: Record<TutorVerdict, Recall> = { forgot: 0, partial: 1, remember: 2 }
const RATE_CLASS: Record<Recall, string> = {
  0: 'bg-danger-soft text-danger',
  1: 'bg-warning-soft text-warning-muted',
  2: 'bg-success-soft text-success-ink',
}
const FEEDBACK_CLASS: Record<Recall, string> = {
  0: 'bg-danger-soft text-danger',
  1: 'bg-warning-soft text-warning-ink',
  2: 'bg-success-soft text-success-ink',
}

interface Answered {
  answer: string | null
  feedback: { verdict: TutorVerdict; text: string; page: number | null } | null
  rating: Recall
}

/**
 * Ispitaj me (board "Tutor · Ispitaj me") and, with `?oral=1`, Usmeni: a round of the recall
 * gate's questions filled up from the source text. The tutor proposes a grade, the student picks
 * the rating; at the end the ratings go to FSRS (`review_logs`, `levelAfter()`) as in a check.
 */
export function TutorQuizPage() {
  const ctx = useTutor()
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const oral = params.get('oral') === '1'
  const { items: base } = useRound(ctx)
  const fill = useTextQuestions()
  const [filled, setFilled] = useState<CheckItem[] | null>(null)
  const [at, setAt] = useState(0)
  const [done, setDone] = useState<Record<string, Answered>>({})
  // The round as it was asked, kept with the outcomes (the cards refetch after saving).
  const [ended, setEnded] = useState<{ items: CheckItem[]; outcomes: Outcome[] } | null>(null)
  const writer = useReviewWriter()
  const asked = useRef(false)

  // The round: what exists for the chapter, then the tutor's questions from the text. The base
  // is fixed once the round starts, so ratings keep their items.
  const [fixed, setFixed] = useState<CheckItem[] | null>(null)
  const round = fixed ?? base
  const need = round ? missing(round, ctx.hasText) : 0
  const items = round && need === 0 ? round : filled
  useEffect(() => {
    if (!base || need === 0 || asked.current) return
    asked.current = true
    fill.mutate(
      { unit_id: ctx.unit.id, count: need, avoid: base.map((i) => i.prompt.slice(0, 500)) },
      {
        onSuccess: (r) => {
          setFixed(base)
          setFilled([...base, ...textItems(ctx.leaves, r.questions)])
        },
        onError: () => {
          setFixed(base)
          setFilled(base)
        },
      },
    )
  }, [base, need, ctx, fill])

  const finish = async (final: Record<string, Answered>) => {
    if (!items) return
    const ratings = Object.fromEntries(Object.entries(final).map(([k, v]) => [k, v.rating]))
    const reviews = checkReviews(items, ratings)
    const asked = items
    setEnded({ items: asked, outcomes: await writer.save(reviews.units, reviews.cards) })
  }

  const title = oral ? t('tutor.modes.oral') : t('tutor.modes.quiz')
  if (ended)
    return <RoundEnd items={ended.items} answered={done} outcomes={ended.outcomes} oral={oral} />
  if (!items)
    return (
      <div className="flex flex-col gap-4">
        <ScreenTitle title={title} sub={ctx.unit.title} />
        <span role="status" className="px-1 text-sm text-ink-muted">
          {t('tutor.quiz.preparing')}
        </span>
      </div>
    )
  if (items.length === 0)
    return (
      <div className="flex flex-col gap-4">
        <ScreenTitle title={title} sub={ctx.unit.title} />
        <p className="surface rounded-card px-4 py-3.5 text-[15px] text-ink-secondary">
          {t('tutor.quiz.empty')}
        </p>
      </div>
    )

  const item = items[Math.min(at, items.length - 1)]!
  const pick = (answered: Answered) => {
    const next = { ...done, [item.key]: answered }
    setDone(next)
    if (at + 1 >= items.length) void finish(next)
    else setAt(at + 1)
  }

  return (
    <QuizStep
      key={item.key}
      title={title}
      index={at}
      total={items.length}
      item={item}
      onPick={pick}
      onUndo={at > 0 ? () => setAt(at - 1) : undefined}
      oral={oral}
    />
  )
}

function sourceTag(t: TFunction, item: CheckItem): string {
  if (item.source === 'exam_question')
    return t('tutor.quiz.examQuestion', { label: item.question?.label ?? '' }).trim()
  if (item.source === 'card') return t('tutor.quiz.card')
  return t('tutor.quiz.fromText')
}

function QuizStep({
  title,
  index,
  total,
  item,
  onPick,
  onUndo,
  oral,
}: {
  oral: boolean
  title: string
  index: number
  total: number
  item: CheckItem
  onPick: (a: Answered) => void
  onUndo?: () => void
}) {
  const ctx = useTutor()
  const { t } = useTranslation()
  const grade = useGrade()
  const toast = useToast((s) => s.show)
  const [answer, setAnswer] = useState('')
  const [shown, setShown] = useState(false)
  const [typing, setTyping] = useState(false)
  const navigate = useNavigate()
  const feedback = grade.data
    ? { verdict: grade.data.verdict, text: grade.data.feedback, page: grade.data.page }
    : null
  const suggested = feedback ? RECALL_OF[feedback.verdict] : shown ? 0 : null
  const error = grade.error
    ? grade.error instanceof AiCallError
      ? grade.error.code
      : 'failed'
    : null

  const check = (text = answer) =>
    grade.mutate(
      {
        unit_id: ctx.unit.id,
        question: item.prompt,
        reference: item.answer,
        answer: text.trim(),
      },
      { onSettled: () => setShown(true) },
    )
  const rate = (r: Recall) => {
    onPick({ answer: answer.trim() || null, feedback, rating: r })
    if (onUndo !== undefined || index + 1 < total)
      toast(t('tutor.quiz.rated', { rating: t(`review.rate.${r}`) }), {
        label: t('common.undo'),
        run: () => onUndo?.(),
      })
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle title={title} sub={t('tutor.quiz.progress', { n: index + 1, total })} />
      <div
        role="progressbar"
        aria-label={t('tutor.quiz.questions')}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index}
        className="-mt-2 h-1.5 overflow-hidden rounded-full bg-hairline"
      >
        <span
          className="block h-full rounded-full bg-ai transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${(index / total) * 100}%` }}
        />
      </div>
      <section className="flex flex-col gap-3 rounded-card bg-subject-lavender-soft p-5 text-subject-lavender-ink">
        <span className="flex h-6 self-start items-center rounded-lg bg-raised/60 px-2 text-xs font-bold">
          {sourceTag(t, item)}
        </span>
        <div className="[&_.markdown]:font-display [&_.markdown]:text-[22px] [&_.markdown]:leading-[1.2] [&_.markdown]:font-bold">
          <LazyMarkdown>{item.prompt}</LazyMarkdown>
        </div>
      </section>

      {oral && !typing && !shown && !grade.isPending && (
        <OralAsk
          index={index}
          total={total}
          prompt={item.prompt}
          onAnswer={(text) => {
            setAnswer(text)
            check(text)
          }}
          onType={() => setTyping(true)}
          onClose={() => navigate('..', { relative: 'path' })}
        />
      )}
      {!shown ? (
        <div className="flex flex-col gap-2">
          <label>
            <span className="sr-only">{t('tutor.quiz.yourAnswer')}</span>
            <textarea
              rows={5}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              maxLength={4000}
              placeholder={t('tutor.quiz.placeholder')}
              className="w-full resize-none rounded-[18px] bg-raised px-4 py-3.5 text-base leading-6 shadow-[inset_0_0_0_1.5px_var(--color-hairline)] outline-none"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShown(true)}
              className="h-[52px] flex-1 rounded-[16px] bg-subject-blue-soft text-[15px] font-bold text-brand-strong"
            >
              {t('tutor.quiz.dontKnow')}
            </button>
            <button
              type="button"
              disabled={!answer.trim() || grade.isPending}
              onClick={() => check()}
              className="btn-primary h-[52px] flex-[2] rounded-[16px] text-base font-bold disabled:opacity-60"
            >
              {grade.isPending ? t('tutor.thinking') : t('tutor.quiz.check')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {answer.trim() && (
            <section className="flex flex-col gap-2.5 rounded-card bg-raised p-4 shadow-[inset_0_0_0_1.5px_var(--color-hairline)]">
              <span className="text-[13px] font-bold text-ink-secondary">
                {t('tutor.quiz.yourAnswer')}
              </span>
              <span className="text-[15px] leading-[22px] whitespace-pre-wrap">
                {answer.trim()}
              </span>
            </section>
          )}
          {feedback && (
            <section
              className={cn(
                'flex flex-col gap-2 rounded-card p-4',
                FEEDBACK_CLASS[RECALL_OF[feedback.verdict]],
              )}
            >
              <span className="flex h-6 items-center gap-1.5 self-start rounded-lg bg-raised/60 px-2 text-xs font-bold">
                <SparkleIcon size={14} />
                {t('tutor.quiz.thinks', { verdict: t(`tutor.quiz.verdict.${feedback.verdict}`) })}
              </span>
              <div className="[&_.markdown]:text-[15px] [&_.markdown]:leading-[22px]">
                <LazyMarkdown>{feedback.text}</LazyMarkdown>
              </div>
              <span className="self-start">
                <PageChip page={feedback.page} />
              </span>
            </section>
          )}
          {error && (
            <span role="alert" className="text-sm text-danger">
              {t(`owl.error.${error as 'failed'}`)}
            </span>
          )}
          {item.answer && (!feedback || feedback.verdict !== 'remember') && (
            <section className="surface flex flex-col gap-1.5 rounded-card px-4 py-3.5">
              <span className="text-[13px] font-bold text-ink-secondary">
                {t('tutor.quiz.correct')}
              </span>
              <div className="[&_.markdown]:text-[15px] [&_.markdown]:leading-[22px]">
                <LazyMarkdown>{item.answer}</LazyMarkdown>
              </div>
            </section>
          )}
          <span className="mx-1 mt-1 text-base font-bold">{t('tutor.quiz.howMuch')}</span>
          <div role="group" aria-label={t('tutor.quiz.howMuch')} className="flex gap-2">
            {([0, 1, 2] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => rate(r)}
                className={cn(
                  'min-h-14 flex-1 rounded-[16px] p-2 text-[15px] font-bold',
                  RATE_CLASS[r],
                  suggested === r && 'shadow-[inset_0_0_0_2.5px_currentColor]',
                )}
              >
                {t(`review.rate.${r}`)}
              </button>
            ))}
          </div>
          <p className="mx-1 text-[13px] leading-[1.4] text-ink-secondary">
            {t('tutor.quiz.youDecide')}
          </p>
        </div>
      )}
    </div>
  )
}

/** Kraj runde (board "Tutor · kraj runde"): time, ratings, next review and the unit's level. */
function RoundEnd({
  items,
  answered,
  outcomes,
  oral,
}: {
  items: CheckItem[]
  answered: Record<string, Answered>
  outcomes: Outcome[]
  oral: boolean
}) {
  const ctx = useTutor()
  const { t } = useTranslation()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const toast = useToast((s) => s.success)
  const { data: active } = useActiveSession()
  const addCards = useAddMaterialCards()
  const now = useNow(30_000)
  const boundary = useDayBoundary()
  const leafIds = new Set(ctx.leaves.map((l) => l.id))
  const tutorMs = active
    ? activeMs(
        active.segments
          .filter((s) => s.kind === 'tutor' && s.unit_id !== null && leafIds.has(s.unit_id))
          .concat(active.segments.filter((s) => s.kind === 'tutor' && s.unit_id === ctx.unit.id))
          .filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i)
          .map(toSegment),
        now,
      )
    : 0
  const counts = [0, 0, 0]
  for (const a of Object.values(answered)) counts[a.rating]!++
  const next = outcomes
    .map((o) => o.nextReviewOn)
    .filter((d): d is string => d !== null)
    .sort()[0]
  const unitOutcome = outcomes.find((o) => o.kind === 'unit' && leafIds.has(o.id))
  const missed = items.filter(
    (i) => answered[i.key] && answered[i.key]!.rating < 2 && !i.card && i.answer,
  )
  const close = async () => {
    await ctx.finish()
    navigate(`/subjects/${ctx.subjectId}/sources/${ctx.source.id}/units/${ctx.unit.id}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle
        title={t('tutor.end.title')}
        sub={t('tutor.end.sub', { unit: ctx.unit.title })}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5 rounded-card bg-subject-blue-soft p-4 text-brand-strong">
          <span className="text-[13px] font-bold">{t('tutor.end.time')}</span>
          <span className="font-display text-[28px] font-bold text-ink tabular-nums">
            {formatDuration(t, tutorMs / MINUTE)}
          </span>
          <span className="text-[13px]">{t('tutor.end.timeSub')}</span>
        </div>
        <div className="surface flex flex-col gap-0.5 rounded-card p-4">
          <span className="text-[13px] font-bold text-ink-secondary">
            {t('tutor.end.answered')}
          </span>
          <span className="font-display text-[28px] font-bold tabular-nums">
            {t('tutor.end.questions', { count: Object.keys(answered).length })}
          </span>
          <span className="text-[13px] text-ink-secondary tabular-nums">
            {t('tutor.end.split', { yes: counts[2], partial: counts[1], no: counts[0] })}
          </span>
        </div>
        {next && (
          <div className="col-span-2 flex items-center gap-3 rounded-card bg-subject-lavender-soft p-4 text-subject-lavender-ink">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-bold">{t('tutor.end.next')}</span>
              <span className="font-display text-[28px] font-bold text-ink">
                {format(toDisplayDate(next), 'd. MMM', { locale: dateFnsLocales[locale] })}
              </span>
            </span>
            <span className="text-right text-[13px]">{t('tutor.end.nextSub')}</span>
          </div>
        )}
      </div>
      <h2 className="mt-3 px-1 font-display text-[22px] font-bold">{t('tutor.end.perQuestion')}</h2>
      <div className="surface overflow-hidden rounded-card">
        {items
          .filter((i) => answered[i.key])
          .map((i) => {
            const a = answered[i.key]!
            const how = [
              oral
                ? t('tutor.end.spoken')
                : a.answer
                  ? t('tutor.end.written')
                  : t('tutor.end.skipped'),
            ]
            return (
              <div
                key={i.key}
                className="flex min-h-14 items-center gap-3 py-2 pr-3 pl-4 [&+&]:border-t [&+&]:border-hairline"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold">
                    {sourceTag(t, i)} · {i.prompt}
                  </span>
                  <span className="text-[13px] text-ink-secondary">{how.join(' · ')}</span>
                </span>
                <span
                  className={cn(
                    'flex h-6 shrink-0 items-center rounded-lg px-2 text-xs font-bold',
                    RATE_CLASS[a.rating],
                  )}
                >
                  {t(`review.rate.${a.rating}`).toLowerCase()}
                </span>
              </div>
            )
          })}
      </div>
      {unitOutcome && (
        <>
          <h2 className="mt-3 px-1 font-display text-[22px] font-bold">{t('tutor.end.unit')}</h2>
          <div className="surface flex min-h-14 items-center gap-3 rounded-card py-2 pr-3 pl-4">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-bold">{ctx.unit.title}</span>
              <span className="text-[13px] text-ink-secondary">
                {statusLabel(t, 'chapter', unitOutcome.levelBefore)} →{' '}
                {statusLabel(t, 'chapter', unitOutcome.levelAfter)}
              </span>
            </span>
          </div>
          <p className="px-1 text-[13px] leading-[1.4] text-ink-secondary">
            {t('tutor.end.levelHint')}
          </p>
        </>
      )}
      <div className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void close()}
          className="btn-primary h-14 rounded-[16px] text-[17px] font-bold"
        >
          {t('tutor.end.done')}
        </button>
        {missed.length > 0 && (
          <button
            type="button"
            disabled={addCards.isPending || addCards.isSuccess}
            onClick={() =>
              addCards.mutate(
                {
                  unitId: ctx.leaves[0]!.id,
                  cards: missed.map((i) => ({ front: i.prompt, back: i.answer! })),
                  firstReview: addDays(localDay(now, boundary), 1),
                },
                { onSuccess: (n) => toast(t('materialCards.added', { count: n })) },
              )
            }
            className="h-[52px] rounded-[16px] bg-subject-blue-soft text-[15px] font-bold text-brand-strong disabled:opacity-60"
          >
            {t('tutor.end.missedToCards')}
          </button>
        )}
        <Link
          to=".."
          relative="path"
          className="flex h-12 items-center justify-center text-[15px] font-bold text-brand-strong"
        >
          {t('tutor.end.again')}
        </Link>
      </div>
    </div>
  )
}

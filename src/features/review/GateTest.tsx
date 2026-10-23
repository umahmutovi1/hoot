import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LazyMarkdown } from '@/components/LazyMarkdown'
import { useToast } from '@/components/toast-store'
import { useNow } from '@/features/session/useNow'
import { useSaveCard, useUpdateUnit } from '@/features/sources/api'
import type { Card, Unit } from '@/features/sources/model'
import type { Recall } from '@/lib/srs'
import { cn } from '@/lib/utils'
import { GATE_QUESTIONS, QUIZ_QUESTIONS } from '@shared/schemas.ts'
import { AiAsk } from './AiAsk'
import {
  blurtClock,
  gateItems,
  type AiQuestions,
  type AiSource,
  type GateAnswers,
  type GateItem,
  type GateSource,
  type GateTarget,
} from './gate'
import { RateButtons } from './RateButtons'
import { usePagePhotoQuestions, useProposeAnswer, useRecallQuestions } from './recallApi'
import { AiCallError } from '@/features/owl/api'

/** Order of the chips (RecallGate mockup), then the sources added with AI. */
const SOURCES: GateSource[] = ['exam_question', 'notes', 'outline', 'general', 'page_photo', 'card']
const AI_SOURCES = new Set<GateSource>(['page_photo', 'general'])

const errorCode = (err: unknown) =>
  err ? (err instanceof AiCallError ? err.code : 'failed') : null

/**
 * One test of the recall gate (RecallGate mockup): blurting, or questions from the sources that
 * exist for the chapter. Every item shows its answer first, then takes a rating 0–2.
 */
export function GateTest({
  target,
  subjectId,
  questions,
  cards,
  answers,
  onChange,
  footer,
  aiReady,
  quiz = false,
}: {
  target: GateTarget
  subjectId: string
  questions: Unit[]
  cards: Card[]
  answers: GateAnswers
  onChange: (a: GateAnswers) => void
  /** Primary action when the current source has no more items. */
  footer: { label: string; run: () => void; busy?: boolean }
  /** AI questions can be asked (online, configured). */
  aiReady: boolean
  /** Kviz: 5–10 AI questions, asked right away (notes, else general knowledge). */
  quiz?: boolean
}) {
  const { t } = useTranslation()
  const count = quiz ? QUIZ_QUESTIONS : GATE_QUESTIONS
  const hasNotes = target.leaves.some((l) => l.notes?.trim())
  const [asked, setAsked] = useState<Set<AiSource>>(
    () => new Set(quiz && aiReady ? [hasNotes ? 'notes' : 'general'] : []),
  )
  const [plainNotes, setPlainNotes] = useState(!aiReady)
  const notesAi = useRecallQuestions(target.key, 'notes', count, aiReady && asked.has('notes'))
  const generalAi = useRecallQuestions(
    target.key,
    'general',
    count,
    aiReady && asked.has('general'),
  )
  const photoAi = usePagePhotoQuestions(target.key, count)
  const ai: AiQuestions = {
    notes: notesAi.data,
    general: generalAi.data,
    page_photo: photoAi.data,
  }
  const items = gateItems(target, questions, cards, ai)
  const available = SOURCES.filter((s) =>
    s === 'outline'
      ? target.leaves.length > 1
      : s === 'notes'
        ? hasNotes
        : AI_SOURCES.has(s)
          ? aiReady || items[s as 'general'].length > 0
          : items[s as 'card'].length > 0,
  )
  const [tab, setTab] = useState<'questions' | 'blurt'>(
    available.length > 0 ? 'questions' : 'blurt',
  )
  const [source, setSource] = useState<GateSource | null>(
    quiz && aiReady ? (hasNotes ? 'notes' : 'general') : (available[0] ?? null),
  )
  const [index, setIndex] = useState<Record<string, number>>({})
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [blurtStart, setBlurtStart] = useState<number | null>(() =>
    available.length === 0 ? Date.now() : null,
  )
  const [compare, setCompare] = useState(false)
  const isQuestion = target.leaves.length === 1 && target.leaves[0]!.kind === 'question'

  const list = source && source !== 'outline' ? items[source] : []
  // An AI source shows its "ask" panel until its questions are there.
  const aiPanel: AiSource | null =
    source === 'general' || source === 'page_photo'
      ? list.length === 0
        ? source
        : null
      : source === 'notes' && aiReady && !plainNotes && !ai.notes
        ? 'notes'
        : null
  const aiState = {
    notes: { busy: notesAi.isFetching, error: errorCode(notesAi.error) },
    general: { busy: generalAi.isFetching, error: errorCode(generalAi.error) },
    page_photo: { busy: photoAi.isPending, error: errorCode(photoAi.error) },
  }
  const i = source ? Math.min(index[source] ?? 0, Math.max(0, list.length - 1)) : 0
  const item = list[i]
  const hasNext =
    source !== null && source !== 'outline' && tab === 'questions' && i < list.length - 1

  const rate = (key: string, r: Recall) =>
    onChange({ ...answers, ratings: { ...answers.ratings, [key]: r } })
  const openBlurt = () => {
    setTab('blurt')
    setBlurtStart((s) => s ?? Date.now())
  }

  return (
    <>
      <div
        role="tablist"
        aria-label={t('recall.title')}
        className="flex rounded-[22px] bg-brand-soft p-1"
      >
        {(['blurt', 'questions'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => (k === 'blurt' ? openBlurt() : setTab('questions'))}
            className={cn(
              'h-10 flex-1 rounded-[18px] text-sm font-semibold',
              tab === k ? 'bg-white' : 'bg-transparent',
            )}
          >
            {t(k === 'questions' && aiReady ? 'recall.tabs.ai' : `recall.tabs.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'questions' && (
        <div className="flex flex-col gap-3.5 rounded-card-lg glass p-5">
          {available.length === 0 ? (
            <p className="text-sm text-ink-secondary">{t('recall.emptyQuestions')}</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink-secondary">
                  {t('recall.askFrom')}
                </span>
                <div
                  role="radiogroup"
                  aria-label={t('recall.askFromLabel')}
                  className="flex flex-wrap gap-1.5"
                >
                  {available.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={source === s}
                      onClick={() => setSource(s)}
                      className={cn(
                        'h-11 rounded-full border px-3 text-[13px] font-semibold',
                        source === s
                          ? 'border-ink bg-ink text-white'
                          : 'border-line bg-white/55 text-ink',
                      )}
                    >
                      {t(`recall.sources.${s}`)}
                    </button>
                  ))}
                </div>
              </div>
              {list.length > 1 && !aiPanel && <Dots count={list.length} at={i} />}
              {aiPanel ? (
                <AiAsk
                  source={aiPanel}
                  count={count}
                  busy={aiState[aiPanel].busy}
                  error={aiState[aiPanel].error}
                  onAsk={() => setAsked((s) => new Set(s).add(aiPanel))}
                  onPhotos={(files) => photoAi.mutate(files)}
                  onPlain={aiPanel === 'notes' ? () => setPlainNotes(true) : undefined}
                />
              ) : source === 'outline' ? (
                <Outline target={target} answers={answers} onChange={onChange} />
              ) : item ? (
                <Item
                  key={item.key}
                  item={item}
                  label={itemLabel(t, item, i, list.length, questions)}
                  subjectId={subjectId}
                  cardUnitId={target.leaves[0]!.id}
                  aiReady={aiReady}
                  revealed={revealed.has(item.key)}
                  onReveal={() => setRevealed((s) => new Set(s).add(item.key))}
                />
              ) : null}
            </>
          )}
        </div>
      )}

      {tab === 'blurt' && (
        <Blurt
          target={target}
          startedAt={blurtStart ?? 0}
          compare={compare}
          onCompare={() => setCompare(true)}
        />
      )}

      {tab === 'questions' && item && source !== 'outline' && !aiPanel && (
        <RateButtons
          value={answers.ratings[item.key] ?? null}
          disabled={!revealed.has(item.key)}
          onPick={(r) => rate(item.key, r)}
        />
      )}
      {tab === 'blurt' && (
        <RateButtons
          value={answers.blurt}
          disabled={!compare}
          onPick={(r) => onChange({ ...answers, blurt: r })}
        />
      )}

      <div className="flex gap-2.5 rounded-[20px] bg-warning-soft px-4 py-3.5">
        <span className="text-[13px] leading-[1.4] text-warning-ink">
          {t(isQuestion ? 'recall.noteQuestion' : aiReady ? 'recall.noteAi' : 'recall.note')}
        </span>
      </div>

      <button
        type="button"
        disabled={footer.busy}
        onClick={() => (hasNext ? setIndex((x) => ({ ...x, [source!]: i + 1 })) : footer.run())}
        className="mt-auto h-14 rounded-full btn-primary text-base font-semibold disabled:opacity-50"
      >
        {hasNext ? t('recall.nextQuestion') : footer.label}
      </button>
    </>
  )
}

function itemLabel(t: TFunction, item: GateItem, i: number, total: number, questions: Unit[]) {
  if (item.source === 'exam_question') {
    const q = questions.find((x) => x.id === item.refId)
    return t('recall.label.exam_question', { label: q?.label ?? '' })
  }
  return t(`recall.label.${item.source as 'notes' | 'card' | 'general' | 'page_photo'}`, {
    n: i + 1,
    total,
  })
}

function Dots({ count, at }: { count: number; at: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, k) => (
        <span
          key={k}
          className={cn('h-1.5 flex-1 rounded-full', k <= at ? 'bg-brand-accent' : 'bg-line')}
        />
      ))}
    </div>
  )
}

const ANSWER_TONE: Partial<Record<GateSource, { box: string; label: string }>> = {
  notes: { box: 'bg-success-soft', label: 'text-subject-green-deep' },
  general: { box: 'bg-subject-blue-soft', label: 'text-subject-blue-deep' },
}

function Item({
  item,
  label,
  subjectId,
  cardUnitId,
  aiReady,
  revealed,
  onReveal,
}: {
  item: GateItem
  label: string
  subjectId: string
  /** The leaf a card made from an AI question belongs to. */
  cardUnitId: string
  aiReady: boolean
  revealed: boolean
  onReveal: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const [cardSaved, setCardSaved] = useState(false)
  const update = useUpdateUnit(subjectId)
  const saveCard = useSaveCard()
  const propose = useProposeAnswer()
  const toast = useToast((s) => s.show)
  const prompt =
    item.source === 'notes' && !item.ai
      ? t('recall.notesPrompt', { title: item.prompt })
      : item.prompt
  const noAnswer = item.answer === null
  const tone = ANSWER_TONE[item.source] ?? { box: 'bg-brand-hero', label: 'text-brand-strong' }

  return (
    <>
      <span className="text-xs font-semibold text-brand-muted">{label}</span>
      <p className="text-[19px] leading-[1.35] font-semibold">{prompt}</p>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={t('recall.answerAria')}
        placeholder={t('recall.answerPlaceholder')}
        className="resize-none rounded-input bg-white/40 p-3.5 text-[15px] placeholder:text-ink-placeholder"
      />
      {revealed ? (
        <div
          className={cn(
            'flex flex-col gap-1 rounded-input p-3.5',
            noAnswer ? 'bg-warning-soft' : tone.box,
          )}
        >
          <span
            className={cn('text-xs font-semibold', noAnswer ? 'text-warning-muted' : tone.label)}
          >
            {noAnswer
              ? t('recall.noAnswer')
              : item.aiAnswer
                ? t('recall.answerLabel.aiProposed')
                : t(
                    `recall.answerLabel.${item.source as 'notes' | 'general' | 'page_photo' | 'card'}`,
                  )}
          </span>
          {noAnswer ? (
            <span className="text-[15px] leading-[1.4]">{t('recall.noAnswerBody')}</span>
          ) : (
            <div className="text-[15px] leading-[1.4]">
              <LazyMarkdown>{item.answer!}</LazyMarkdown>
            </div>
          )}
          {noAnswer && aiReady && !propose.data && (
            <button
              type="button"
              disabled={propose.isPending}
              onClick={() => propose.mutate(item.refId)}
              className="mt-1 h-11 self-start rounded-full bg-white/60 px-4 text-sm font-semibold text-brand disabled:opacity-50"
            >
              {propose.isPending ? t('recall.proposing') : t('recall.propose')}
            </button>
          )}
          {propose.error && (
            <span role="alert" className="text-sm text-danger">
              {t(`owl.error.${errorCode(propose.error) as 'failed'}`)}
            </span>
          )}
          {noAnswer && propose.data && (
            <div className="mt-1 flex flex-col gap-1.5 rounded-input bg-white/60 p-3">
              <span className="text-xs font-semibold text-warning-muted">
                {t('recall.proposedLabel')}
              </span>
              <div className="text-[15px] leading-[1.4]">
                <LazyMarkdown>{propose.data}</LazyMarkdown>
              </div>
              {!saved && (
                <button
                  type="button"
                  onClick={() => {
                    update.mutate({
                      id: item.refId,
                      patch: { answer: propose.data, answer_origin: 'ai' },
                    })
                    setSaved(true)
                    toast(t('recall.answerSaved'))
                  }}
                  className="h-11 self-start rounded-full bg-brand-soft px-4 text-sm font-semibold text-brand"
                >
                  {t('recall.saveAnswer')}
                </button>
              )}
            </div>
          )}
          {item.ai && !cardSaved && (
            <button
              type="button"
              onClick={() => {
                saveCard.mutate({
                  id: crypto.randomUUID(),
                  unitId: cardUnitId,
                  front: item.prompt,
                  back: item.answer!,
                  origin: 'ai',
                })
                setCardSaved(true)
                toast(t('recall.cardSaved'))
              }}
              className="mt-1 h-11 self-start rounded-full bg-white/60 px-4 text-sm font-semibold text-brand"
            >
              {t('recall.saveCard')}
            </button>
          )}
          {noAnswer && text.trim() && !saved && (
            <button
              type="button"
              onClick={() => {
                update.mutate({
                  id: item.refId,
                  patch: { answer: text.trim(), answer_origin: 'user' },
                })
                setSaved(true)
                toast(t('recall.answerSaved'))
              }}
              className="mt-1 h-11 self-start rounded-full bg-white/60 px-4 text-sm font-semibold text-brand"
            >
              {t('recall.saveAnswer')}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onReveal}
          className="h-12 rounded-full border-2 border-brand glass text-[15px] font-semibold text-brand"
        >
          {t('recall.reveal')}
        </button>
      )}
    </>
  )
}

function Outline({
  target,
  answers,
  onChange,
}: {
  target: GateTarget
  answers: GateAnswers
  onChange: (a: GateAnswers) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <span className="text-xs font-semibold text-brand-muted">{t('recall.outlineLabel')}</span>
      <span className="text-sm text-ink-secondary">{t('recall.outlineHint')}</span>
      <div className="flex flex-col">
        {target.leaves.map((l) => {
          const v = answers.explained[l.id]
          const set = (x: boolean) =>
            onChange({ ...answers, explained: { ...answers.explained, [l.id]: x } })
          return (
            <div
              key={l.id}
              role="group"
              aria-label={t('recall.outlineAria', { title: l.title })}
              className="flex items-center gap-2 border-t border-hairline py-2.5 first:border-t-0"
            >
              <span className="min-w-0 flex-1 text-[15px]">{l.title}</span>
              {([false, true] as const).map((x) => (
                <button
                  key={String(x)}
                  type="button"
                  aria-pressed={v === x}
                  onClick={() => set(x)}
                  className={cn(
                    'h-11 min-w-12 rounded-full px-3 text-sm font-semibold',
                    v === x ? (x ? 'bg-brand text-white' : 'bg-ink text-white') : 'bg-white/55',
                  )}
                >
                  {t(x ? 'recall.outlineYes' : 'recall.outlineNo')}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </>
  )
}

function Blurt({
  target,
  startedAt,
  compare,
  onCompare,
}: {
  target: GateTarget
  startedAt: number
  compare: boolean
  onCompare: () => void
}) {
  const { t } = useTranslation()
  const now = useNow(1000, !compare)
  const [text, setText] = useState('')
  const notes = target.leaves.filter((l) => l.notes?.trim())
  return (
    <div className="flex flex-col gap-3 rounded-card-lg glass p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-brand-muted">{t('recall.blurtLabel')}</span>
        <span className="rounded-full bg-brand-hero px-2.5 py-1 text-sm font-semibold text-brand tabular-nums">
          {blurtClock(startedAt, now.getTime())}
        </span>
      </div>
      <textarea
        rows={9}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={t('recall.tabs.blurt')}
        placeholder={t('recall.blurtPlaceholder')}
        className="resize-none rounded-input bg-white/40 p-3.5 text-[15px] placeholder:text-ink-placeholder"
      />
      <span className="text-[13px] text-ink-secondary">{t('recall.blurtHint')}</span>
      {compare ? (
        <div className="flex flex-col gap-2 rounded-input bg-success-soft p-3.5">
          <span className="text-xs font-semibold text-subject-green-deep">
            {t('recall.blurtCompareLabel')}
          </span>
          {target.leaves.length > 1 && (
            <ul className="list-disc pl-5 text-[15px]">
              {target.leaves.map((l) => (
                <li key={l.id}>{l.title}</li>
              ))}
            </ul>
          )}
          {notes.map((l) => (
            <div key={l.id} className="text-[15px] leading-[1.4]">
              <LazyMarkdown>{l.notes!}</LazyMarkdown>
            </div>
          ))}
          {notes.length === 0 && target.leaves.length < 2 && (
            <span className="text-[15px]">{t('recall.blurtNothing')}</span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onCompare}
          className="h-12 rounded-full border-2 border-brand glass text-[15px] font-semibold text-brand"
        >
          {t('recall.blurtCompare')}
        </button>
      )}
    </div>
  )
}

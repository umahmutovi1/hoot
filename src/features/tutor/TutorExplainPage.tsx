import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TUTOR_HISTORY } from '@shared/schemas.ts'
import { LazyMarkdown } from '@/components/LazyMarkdown'
import { SendIcon } from '@/components/icons'
import { ScreenTitle } from '@/components/ScreenTitle'
import { AiCallError } from '@/features/owl/api'
import { PageChip } from '@/features/sources/SummaryView'
import { useExplain } from './api'
import { useTutor } from './context'

interface Turn {
  role: 'student' | 'tutor'
  text: string
  quote?: { text: string; page: number | null } | null
}

type Style = 'plain' | 'example' | 'simpler'

/** Objasni (board "Tutor · Objasni"): answers from the source text with the quoted page. */
export function TutorExplainPage() {
  const ctx = useTutor()
  const { t } = useTranslation()
  const explain = useExplain()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const error = explain.error
    ? explain.error instanceof AiCallError
      ? explain.error.code
      : 'failed'
    : null

  const ask = (question: string, style: Style = 'plain') => {
    const q = question.trim()
    if (!q || explain.isPending) return
    const history = turns
      .slice(-TUTOR_HISTORY)
      .map((x) => ({ role: x.role, text: x.text.slice(0, 4000) }))
    setTurns((list) => [...list, { role: 'student', text: q }])
    setDraft('')
    explain.mutate(
      { unit_id: ctx.unit.id, question: q, style, history },
      {
        onSuccess: (r) =>
          setTurns((list) => [...list, { role: 'tutor', text: r.answer, quote: r.quote }]),
      },
    )
  }
  const last = [...turns].reverse().find((x) => x.role === 'student')?.text

  return (
    <div className="flex flex-1 flex-col gap-5 pb-2">
      <ScreenTitle
        title={t('tutor.modes.explain')}
        sub={t('tutor.explain.sub', { unit: ctx.unit.title })}
      />
      {turns.length === 0 && (
        <p className="px-1 text-[15px] leading-[22px] text-ink-secondary">
          {t('tutor.explain.empty')}
        </p>
      )}
      {turns.map((turn, i) =>
        turn.role === 'student' ? (
          <div
            key={i}
            className="max-w-[84%] self-end rounded-[22px_22px_6px_22px] bg-brand px-4 py-3 text-base leading-[23px] text-ground"
          >
            {turn.text}
          </div>
        ) : (
          <div key={i} className="flex max-w-[94%] flex-col gap-3">
            <div className="[&_.markdown]:text-base [&_.markdown]:leading-6">
              <LazyMarkdown>{turn.text}</LazyMarkdown>
            </div>
            {turn.quote && (
              <figure className="surface m-0 flex flex-col gap-1.5 rounded-[18px] px-3.5 py-3">
                <span className="text-xs font-bold text-ink-secondary">
                  {t('tutor.explain.fromBook')}
                </span>
                <blockquote className="m-0 text-[15px] leading-[22px]">
                  „{turn.quote.text}“
                </blockquote>
                <span className="self-start">
                  <PageChip page={turn.quote.page} />
                </span>
              </figure>
            )}
          </div>
        ),
      )}
      {explain.isPending && (
        <span className="text-sm text-ink-muted" role="status">
          {t('tutor.thinking')}
        </span>
      )}
      {error && (
        <span role="alert" className="text-sm text-danger">
          {t(`owl.error.${error as 'failed'}`)}
        </span>
      )}
      {last && !explain.isPending && turns.at(-1)?.role === 'tutor' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => ask(last, 'example')}
            className="surface h-11 rounded-[14px] px-3.5 text-sm font-bold"
          >
            {t('tutor.explain.example')}
          </button>
          <button
            type="button"
            onClick={() => ask(last, 'simpler')}
            className="surface h-11 rounded-[14px] px-3.5 text-sm font-bold"
          >
            {t('tutor.explain.simpler')}
          </button>
          <Link
            to="../quiz"
            className="surface flex h-11 items-center rounded-[14px] px-3.5 text-sm font-bold"
          >
            {t('tutor.explain.quizMe')}
          </Link>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(draft)
        }}
        className="sticky bottom-[calc(16px+var(--nav-offset,0px)+env(safe-area-inset-bottom)+var(--vv-bottom,0px))] z-10 mt-auto flex h-[52px] items-center gap-1 rounded-[18px] bg-raised pr-1.5 pl-4 shadow-[inset_0_0_0_1.5px_var(--color-hairline)] keyboard:bottom-[calc(8px+var(--vv-bottom,0px))]"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
          placeholder={t('tutor.explain.placeholder')}
          aria-label={t('tutor.explain.placeholder')}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <button
          type="submit"
          aria-label={t('tutor.explain.send')}
          disabled={!draft.trim() || explain.isPending}
          className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-brand text-ground disabled:opacity-50"
        >
          <SendIcon size={20} />
        </button>
      </form>
    </div>
  )
}

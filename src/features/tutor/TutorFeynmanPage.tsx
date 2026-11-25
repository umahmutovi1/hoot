import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LazyMarkdown } from '@/components/LazyMarkdown'
import { ScreenTitle } from '@/components/ScreenTitle'
import { AiCallError } from '@/features/owl/api'
import { PageChip } from '@/features/sources/SummaryView'
import { useFeynman } from './api'
import { useTutor } from './context'

/**
 * Svojim riječima (board "Tutor · Svojim riječima", Feynman): the student explains the chapter,
 * the tutor names what is good and at most three gaps with a hint and a page. No rating.
 */
export function TutorFeynmanPage() {
  const ctx = useTutor()
  const { t } = useTranslation()
  const feynman = useFeynman()
  const [text, setText] = useState('')
  const topic = ctx.unit.title
  const result = feynman.data
  const error = feynman.error
    ? feynman.error instanceof AiCallError
      ? feynman.error.code
      : 'failed'
    : null

  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle title={t('tutor.modes.feynman')} sub={t('tutor.feynman.sub', { topic })} />
      <span className="px-1 text-sm font-bold">{t('tutor.feynman.yours')}</span>
      {result ? (
        <div className="-mt-2 rounded-[18px] bg-raised px-4 py-3.5 text-base leading-6 whitespace-pre-wrap shadow-[inset_0_0_0_1.5px_var(--color-hairline)]">
          {text}
        </div>
      ) : (
        <textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          aria-label={t('tutor.feynman.yours')}
          placeholder={t('tutor.feynman.placeholder')}
          className="-mt-2 w-full resize-none rounded-[18px] bg-raised px-4 py-3.5 text-base leading-6 shadow-[inset_0_0_0_1.5px_var(--color-hairline)] outline-none"
        />
      )}
      {error && (
        <span role="alert" className="text-sm text-danger">
          {t(`owl.error.${error as 'failed'}`)}
        </span>
      )}
      {result ? (
        <>
          <h2 className="mt-3 px-1 font-display text-[22px] font-bold">
            {t('tutor.feynman.noticed')}
          </h2>
          <section className="flex flex-col gap-1.5 rounded-card bg-success-soft px-[18px] py-4 text-success-ink">
            <span className="text-[13px] font-bold">{t('tutor.feynman.good')}</span>
            <div className="text-ink [&_.markdown]:text-base [&_.markdown]:leading-[23px]">
              <LazyMarkdown>{result.good}</LazyMarkdown>
            </div>
          </section>
          {result.gaps.length > 0 && (
            <section className="flex flex-col gap-3 rounded-card bg-warning-soft px-[18px] py-4 text-warning-ink">
              <span className="text-[13px] font-bold text-warning-muted">
                {t('tutor.feynman.gaps', { count: result.gaps.length })}
              </span>
              {result.gaps.map((g, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <span className="text-base leading-[23px] font-bold">{g.text}</span>
                  <div className="[&_.markdown]:text-[15px] [&_.markdown]:leading-[22px]">
                    <LazyMarkdown>{g.hint}</LazyMarkdown>
                  </div>
                  <span className="self-start">
                    <PageChip page={g.page} />
                  </span>
                </div>
              ))}
            </section>
          )}
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => feynman.reset()}
              className="btn-primary h-14 rounded-[16px] text-[17px] font-bold"
            >
              {t('tutor.feynman.again')}
            </button>
            <Link
              to=".."
              relative="path"
              className="flex h-[52px] items-center justify-center rounded-[16px] bg-subject-blue-soft text-[15px] font-bold text-brand-strong"
            >
              {t('tutor.feynman.enough')}
            </Link>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={!text.trim() || feynman.isPending}
          onClick={() => feynman.mutate({ unit_id: ctx.unit.id, topic, explanation: text.trim() })}
          className="btn-primary h-14 rounded-[16px] text-[17px] font-bold disabled:opacity-60"
        >
          {feynman.isPending ? t('tutor.thinking') : t('tutor.feynman.check')}
        </button>
      )}
      <p className="px-1 text-[13px] leading-[1.4] text-ink-secondary">{t('tutor.feynman.hint')}</p>
    </div>
  )
}

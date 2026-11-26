import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { CheckIcon, CloseIcon, PencilIcon, UndoIcon } from '@/components/icons'
import { LazyMarkdown } from '@/components/LazyMarkdown'
import { useVoiceSettings } from '@/features/voice/store'
import { useDictation } from '@/features/voice/useDictation'
import { useSpeech } from '@/features/voice/useSpeech'

/**
 * Usmeni (board "Tutor · Usmeni"): Hoot asks (read aloud in English; in Bosnian the question is
 * written), the student answers by voice (Whisper on the phone), "Gotovo" sends the answer to be
 * graded. "Piši" falls back to typing.
 */
export function OralAsk({
  index,
  total,
  prompt,
  onAnswer,
  onType,
  onClose,
}: {
  index: number
  total: number
  prompt: string
  onAnswer: (text: string) => void
  onType: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const speech = useSpeech()
  const dictation = useDictation()
  const byVoice = useVoiceSettings((s) => s.answerByVoice)
  const [heard, setHeard] = useState('')
  const started = useRef(false)
  const { speak, available } = speech
  const { start, supported } = dictation

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (available) speak(prompt)
    if (byVoice && supported) void start()
  }, [available, speak, prompt, byVoice, supported, start])

  const done = async () => {
    speech.stop()
    const text = dictation.state === 'listening' ? await dictation.stop() : heard
    setHeard(text)
    if (text) onAnswer(text)
  }
  const busy = dictation.state === 'transcribing' || dictation.state === 'loading'
  const status =
    dictation.state === 'listening'
      ? t('voice.listening')
      : dictation.state === 'loading'
        ? t('voice.loading', { p: dictation.progress ?? 0 })
        : dictation.state === 'transcribing'
          ? t('voice.transcribing')
          : dictation.state === 'error' || !supported
            ? t('voice.micError')
            : null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tutor.modes.oral')}
      className="fixed inset-0 z-50 bg-brand-strong text-ground"
    >
      <div className="mx-auto flex h-full max-w-[430px] flex-col">
        <div className="mt-3 flex h-14 items-center justify-between px-3">
          <button
            type="button"
            onClick={() => {
              dictation.cancel()
              speech.stop()
              onClose()
            }}
            aria-label={t('tutor.oral.close')}
            className="flex size-11 items-center justify-center"
          >
            <CloseIcon size={22} />
          </button>
          <span className="text-sm font-bold tabular-nums">
            {t('tutor.oral.progress', { n: index + 1, total })}
          </span>
          <span className="w-11" />
        </div>
        <span className="mx-6 mt-9 text-sm font-bold text-ai">{t('tutor.oral.asks')}</span>
        <div className="mx-6 mt-2.5 [&_.markdown]:font-display [&_.markdown]:text-[28px] [&_.markdown]:leading-[1.15] [&_.markdown]:font-bold">
          <LazyMarkdown>{prompt}</LazyMarkdown>
        </div>
        {!available && (
          <p className="mx-6 mt-3 text-[13px] text-ground/75">{t('tutor.oral.noVoice')}</p>
        )}
        <span className="mx-6 mt-9 text-sm font-bold text-ground/70">{t('tutor.oral.you')}</span>
        <p aria-live="polite" className="mx-6 mt-1.5 text-xl leading-7">
          {heard || status}
          {dictation.state === 'listening' && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-[22px] w-0.5 animate-pulse bg-ai align-[-4px] motion-reduce:animate-none"
            />
          )}
        </p>
        <section className="relative mt-auto flex h-[196px] items-start justify-between bg-ground px-6 pt-7 text-ink">
          <svg
            width="390"
            height="40"
            viewBox="0 0 390 40"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-x-0 -top-[39px] h-10 w-full"
          >
            <path
              d="M0 22 C 48 2, 104 2, 150 18 C 176 28, 214 28, 240 18 C 286 2, 342 2, 390 22 V40 H0 Z"
              className="fill-ground"
            />
          </svg>
          <div className="flex w-[72px] flex-col items-center gap-1.5 pt-3.5">
            <button
              type="button"
              disabled={!available}
              onClick={() => speak(prompt)}
              aria-label={t('voice.repeat')}
              className="surface flex size-14 items-center justify-center rounded-full disabled:opacity-40"
            >
              <UndoIcon size={22} />
            </button>
            <span className="text-[13px] font-bold text-ink-secondary">
              {t('voice.repeatShort')}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void done()}
              aria-label={t('voice.done')}
              className="btn-primary flex size-[88px] items-center justify-center rounded-full shadow-[0_12px_28px_rgb(34_57_90/0.3)] disabled:opacity-60"
            >
              <CheckIcon size={26} />
            </button>
            <span className="text-[13px] font-bold text-brand-strong">{t('voice.done')}</span>
          </div>
          <div className="flex w-[72px] flex-col items-center gap-1.5 pt-3.5">
            <button
              type="button"
              onClick={() => {
                dictation.cancel()
                onType()
              }}
              aria-label={t('voice.type')}
              className="surface flex size-14 items-center justify-center rounded-full"
            >
              <PencilIcon size={22} />
            </button>
            <span className="text-[13px] font-bold text-ink-secondary">{t('voice.typeShort')}</span>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  )
}

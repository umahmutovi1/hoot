import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { CheckIcon, CloseIcon, PencilIcon } from '@/components/icons'
import { Switch } from '@/components/Switch'
import { useLocale } from '@/features/settings/useLocale'
import { useVoiceSettings } from './store'
import { canSpeak } from './text'
import { useDictation } from './useDictation'

export function MicIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 7v4a5 5 0 0 1-10 0V7a5 5 0 0 1 10 0Z" />
      <path d="M20 11a8 8 0 0 1-16 0M12 19v3" />
    </svg>
  )
}

/**
 * Dictation screen (board "AI chat · D Glas"): listens, turns speech into text on the phone and
 * hands it back. In the chat it also has "Odgovori naglas" (English only).
 */
function DictationOverlay({
  onText,
  onClose,
  readAloudSwitch,
}: {
  onText: (text: string) => void
  onClose: () => void
  readAloudSwitch: boolean
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const dictation = useDictation()
  const { speakAloud, set } = useVoiceSettings()
  const [text, setText] = useState('')
  const started = useRef(false)
  const { start } = dictation

  useEffect(() => {
    if (started.current) return
    started.current = true
    void start()
  }, [start])

  const done = async () => {
    const heard = dictation.state === 'listening' ? await dictation.stop() : text
    setText(heard)
    if (heard) onText(heard)
    onClose()
  }
  const status =
    dictation.state === 'loading'
      ? t('voice.loading', { p: dictation.progress ?? 0 })
      : dictation.state === 'transcribing'
        ? t('voice.transcribing')
        : dictation.state === 'error' || !dictation.supported
          ? t('voice.micError')
          : null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('voice.mic')}
      className="fixed inset-0 z-50 bg-brand-strong text-ground"
    >
      <div className="mx-auto flex h-full max-w-[430px] flex-col">
        <div className="mt-3 flex h-14 items-center justify-between px-3">
          <button
            type="button"
            aria-label={t('voice.cancel')}
            onClick={() => {
              dictation.cancel()
              onClose()
            }}
            className="flex size-11 items-center justify-center"
          >
            <CloseIcon size={22} />
          </button>
          {readAloudSwitch && canSpeak(locale) && (
            <span className="flex h-11 items-center gap-2.5 rounded-full bg-ground/12 pr-1.5 pl-3.5 text-[13px] font-bold">
              {t('voice.readAloud')}
              <Switch
                checked={speakAloud}
                onChange={(v) => set({ speakAloud: v })}
                label={t('voice.readAloud')}
                hideLabel
              />
            </span>
          )}
        </div>
        <span className="mx-6 mt-[72px] text-sm font-bold text-ai">
          {dictation.state === 'listening' ? t('voice.listening') : status}
        </span>
        <p
          aria-live="polite"
          className="mx-6 mt-2.5 font-display text-[30px] leading-[1.15] font-bold"
        >
          {text}
          {dictation.state === 'listening' && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-6 w-0.5 animate-pulse bg-ai align-[-4px] motion-reduce:animate-none"
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
          <span className="w-[72px]" />
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={dictation.state === 'transcribing' || dictation.state === 'loading'}
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
              aria-label={t('voice.type')}
              onClick={() => {
                dictation.cancel()
                onClose()
              }}
              className="flex size-14 items-center justify-center rounded-full"
            >
              <PencilIcon size={22} />
            </button>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  )
}

/** The microphone in a composer: opens the dictation screen and returns the text. */
export function MicButton({
  onText,
  readAloudSwitch = false,
  className,
}: {
  onText: (text: string) => void
  readAloudSwitch?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null
  return (
    <>
      <button
        type="button"
        aria-label={t('voice.mic')}
        onClick={() => setOpen(true)}
        className={className ?? 'flex size-11 shrink-0 items-center justify-center text-brand'}
      >
        <MicIcon />
      </button>
      {open && (
        <DictationOverlay
          onText={onText}
          onClose={() => setOpen(false)}
          readAloudSwitch={readAloudSwitch}
        />
      )}
    </>
  )
}

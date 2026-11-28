import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { CheckIcon, CloseIcon, PencilIcon, RefreshIcon } from '@/components/icons'
import { Switch } from '@/components/Switch'
import { useVoiceSettings } from './store'
import { useSpeech } from './useSpeech'
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
  const dictation = useDictation()
  const { speakAloud, set } = useVoiceSettings()
  const canRead = useSpeech().supported
  const [text, setText] = useState('')
  const started = useRef(false)
  const { start } = dictation

  useEffect(() => {
    if (started.current) return
    started.current = true
    void start()
  }, [start])

  // Nothing heard or a failure keeps the screen open: the big button listens again.
  const retry = ['empty', 'failed', 'error'].includes(dictation.state)
  const done = async () => {
    if (retry) {
      setText('')
      void start()
      return
    }
    const heard = dictation.state === 'listening' ? await dictation.stop() : text
    if (!heard) return
    setText(heard)
    onText(heard)
    onClose()
  }
  const status =
    dictation.state === 'loading'
      ? t('voice.loading', { p: dictation.progress ?? 0 })
      : dictation.state === 'transcribing'
        ? t('voice.transcribing')
        : dictation.state === 'empty'
          ? t('voice.empty')
          : dictation.state === 'failed'
            ? t('voice.failed')
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
          {readAloudSwitch && canRead && (
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
            <span className="text-ground/70">{t('voice.speakNow')}</span>
          )}
        </p>
        {dictation.state === 'listening' && <LevelWave level={dictation.level} />}
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
              aria-label={retry ? t('voice.again') : t('voice.done')}
              className="btn-primary flex size-[88px] items-center justify-center rounded-full shadow-[0_12px_28px_rgb(34_57_90/0.3)] disabled:opacity-60"
            >
              {retry ? <RefreshIcon size={26} /> : <CheckIcon size={26} />}
            </button>
            <span className="text-[13px] font-bold text-brand-strong">
              {retry ? t('voice.again') : t('voice.done')}
            </span>
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

/**
 * The board's wave, driven by the microphone's loudness (not a loop): flat when silent, taller
 * when it hears speech, so it is clear the phone is listening.
 */
function LevelWave({ level }: { level: number }) {
  const scale = 0.15 + level * 0.85
  const path = (amp: number) =>
    `M0 80 C 48 ${80 - amp}, 104 ${80 - amp}, 150 ${80 - amp * 0.2} C 176 ${80 + amp * 0.4}, 214 ${80 + amp * 0.4}, 240 ${80 - amp * 0.2} C 286 ${80 - amp}, 342 ${80 - amp}, 390 80`
  return (
    <svg
      viewBox="0 0 390 160"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-10 h-40 w-full"
    >
      <g
        style={{ transform: `scaleY(${scale})`, transformOrigin: 'center' }}
        className="transition-transform duration-100 ease-out motion-reduce:transition-none"
      >
        <path d={path(28)} stroke="rgb(251 245 230 / 0.25)" strokeWidth="3" fill="none" />
        <path
          d={path(40)}
          className="stroke-brand-soft"
          strokeWidth="3"
          fill="none"
          opacity="0.6"
        />
        <path
          d={path(50)}
          className="stroke-ground"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
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

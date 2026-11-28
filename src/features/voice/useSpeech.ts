import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '@/features/settings/useLocale'
import { useVoiceSettings } from './store'
import { canSpeak, speakable } from './text'
import { useSystemVoice } from './useSystemVoice'

let worker: Worker | null = null
const tts = () =>
  (worker ??= new Worker(new URL('./tts.worker.ts', import.meta.url), { type: 'module' }))

/**
 * Reading aloud: Kokoro on the device in English (decision 18 Nov 2026); in Bosnian the phone's
 * own Bosnian, Croatian or Serbian voice when it has one (`speechSynthesis`), otherwise nothing.
 * `supported` says whether this device can read the app language at all; `available` adds the
 * user's switch. `speak()` does nothing when it is not available.
 */
export function useSpeech() {
  const { locale } = useLocale()
  const on = useVoiceSettings((s) => s.speakAloud)
  const systemVoice = useSystemVoice(locale)
  const supported = canSpeak(locale, systemVoice !== null)
  const available = supported && on
  const [speaking, setSpeaking] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const source = useRef<AudioBufferSourceNode | null>(null)
  const ctx = useRef<AudioContext | null>(null)

  const stop = useCallback(() => {
    source.current?.stop()
    source.current = null
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  useEffect(() => stop, [stop])

  const speak = useCallback(
    (markdown: string) => {
      const text = speakable(markdown)
      if (!available || !text) return
      stop()
      setSpeaking(true)
      if (locale !== 'en' && systemVoice) {
        const u = new SpeechSynthesisUtterance(text)
        u.voice = systemVoice
        u.lang = systemVoice.lang
        u.onend = () => setSpeaking(false)
        u.onerror = () => setSpeaking(false)
        window.speechSynthesis.speak(u)
        return
      }
      // Created (and resumed) inside the tap: iOS keeps a context made later suspended and silent.
      const c = (ctx.current ??= new AudioContext())
      void c.resume()
      const w = tts()
      const listen = (
        e: MessageEvent<{ audio?: Float32Array; rate?: number; progress?: number; error?: string }>,
      ) => {
        if (e.data.progress !== undefined) return setProgress(e.data.progress)
        w.removeEventListener('message', listen)
        setProgress(null)
        if (!e.data.audio || !e.data.rate) return setSpeaking(false)
        const buffer = c.createBuffer(1, e.data.audio.length, e.data.rate)
        buffer.copyToChannel(e.data.audio as Float32Array<ArrayBuffer>, 0)
        const node = c.createBufferSource()
        node.buffer = buffer
        node.connect(c.destination)
        node.onended = () => setSpeaking(false)
        void c.resume().then(() => node.start())
        source.current = node
      }
      w.addEventListener('message', listen)
      w.postMessage({ text })
    },
    [available, stop, locale, systemVoice],
  )

  return { supported, available, speaking, progress, speak, stop }
}

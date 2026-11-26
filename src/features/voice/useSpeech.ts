import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '@/features/settings/useLocale'
import { useVoiceSettings } from './store'
import { canSpeak, speakable } from './text'

let worker: Worker | null = null
const tts = () =>
  (worker ??= new Worker(new URL('./tts.worker.ts', import.meta.url), { type: 'module' }))

/**
 * Reading aloud with Kokoro on the device, English only (decision 18 Nov 2026). `available` is
 * false in Bosnian or when the user turned it off; `speak()` then does nothing.
 */
export function useSpeech() {
  const { locale } = useLocale()
  const on = useVoiceSettings((s) => s.speakAloud)
  const available = canSpeak(locale) && on
  const [speaking, setSpeaking] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const source = useRef<AudioBufferSourceNode | null>(null)
  const ctx = useRef<AudioContext | null>(null)

  const stop = useCallback(() => {
    source.current?.stop()
    source.current = null
    setSpeaking(false)
  }, [])

  useEffect(() => stop, [stop])

  const speak = useCallback(
    (markdown: string) => {
      const text = speakable(markdown)
      if (!available || !text) return
      stop()
      setSpeaking(true)
      const w = tts()
      const listen = (
        e: MessageEvent<{ audio?: Float32Array; rate?: number; progress?: number; error?: string }>,
      ) => {
        if (e.data.progress !== undefined) return setProgress(e.data.progress)
        w.removeEventListener('message', listen)
        setProgress(null)
        if (!e.data.audio || !e.data.rate) return setSpeaking(false)
        const c = (ctx.current ??= new AudioContext())
        const buffer = c.createBuffer(1, e.data.audio.length, e.data.rate)
        buffer.copyToChannel(e.data.audio as Float32Array<ArrayBuffer>, 0)
        const node = c.createBufferSource()
        node.buffer = buffer
        node.connect(c.destination)
        node.onended = () => setSpeaking(false)
        node.start()
        source.current = node
      }
      w.addEventListener('message', listen)
      w.postMessage({ text })
    },
    [available, stop],
  )

  return { available, speaking, progress, speak, stop }
}

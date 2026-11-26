import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '@/features/settings/useLocale'
import { cleanTranscript, whisperLanguage } from './text'

export type DictationState = 'idle' | 'listening' | 'transcribing' | 'loading' | 'error'

let worker: Worker | null = null
const stt = () =>
  (worker ??= new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' }))

/** Recorded audio as 16 kHz mono samples, the input Whisper expects. */
async function toSamples(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16000 })
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer())
    if (audio.numberOfChannels === 1) return audio.getChannelData(0)
    const a = audio.getChannelData(0)
    const b = audio.getChannelData(1)
    return a.map((x, i) => (x + b[i]!) / 2)
  } finally {
    void ctx.close()
  }
}

function transcribe(audio: Float32Array, language: string, onProgress: (p: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const w = stt()
    const listen = (e: MessageEvent<{ text?: string; progress?: number; error?: string }>) => {
      if (e.data.progress !== undefined) return onProgress(e.data.progress)
      w.removeEventListener('message', listen)
      if (e.data.error) reject(new Error(e.data.error))
      else resolve(e.data.text ?? '')
    }
    w.addEventListener('message', listen)
    w.postMessage({ audio, language }, [audio.buffer])
  })
}

/**
 * Dictation with Whisper on the device (any app language; Bosnian works). `start()` asks for the
 * microphone, `stop()` returns the text. The first use downloads the model (`progress` 0–100).
 */
export function useDictation() {
  const { locale } = useLocale()
  const [state, setState] = useState<DictationState>('idle')
  const [progress, setProgress] = useState<number | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((t) => t.stop())
    },
    [],
  )

  const start = useCallback(async () => {
    if (!supported) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream)
      chunks.current = []
      r.ondataavailable = (e) => chunks.current.push(e.data)
      r.start()
      recorder.current = r
      setState('listening')
    } catch {
      setState('error')
    }
  }, [supported])

  const stop = useCallback(async (): Promise<string> => {
    const r = recorder.current
    if (!r) return ''
    recorder.current = null
    const done = new Promise<void>((resolve) => (r.onstop = () => resolve()))
    r.stop()
    await done
    r.stream.getTracks().forEach((t) => t.stop())
    setState('transcribing')
    try {
      const samples = await toSamples(new Blob(chunks.current, { type: r.mimeType }))
      const text = await transcribe(samples, whisperLanguage(locale), (p) => {
        setState('loading')
        setProgress(p)
      })
      setState('idle')
      setProgress(null)
      return cleanTranscript(text)
    } catch {
      setState('error')
      return ''
    }
  }, [locale])

  const cancel = useCallback(() => {
    const r = recorder.current
    recorder.current = null
    if (r) {
      r.onstop = null
      r.stop()
      r.stream.getTracks().forEach((t) => t.stop())
    }
    setState('idle')
  }, [])

  return { state, progress, supported, start, stop, cancel }
}

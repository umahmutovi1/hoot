import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '@/features/settings/useLocale'
import { cleanTranscript, whisperLanguage } from './text'

export type DictationState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'loading'
  | 'error'
  /** Transcribed, but nothing was said (or heard). */
  | 'empty'
  /** Recorded, but turning it into text failed (model download, decoding). */
  | 'failed'

let worker: Worker | null = null
const stt = () =>
  (worker ??= new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' }))

const WHISPER_RATE = 16000

/**
 * Recorded audio as 16 kHz mono samples, the input Whisper expects. Decoded at the device's own
 * rate and resampled offline: Safari does not decode into a 16 kHz AudioContext.
 */
async function toSamples(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext()
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer())
    const length = Math.max(1, Math.ceil(audio.duration * WHISPER_RATE))
    const offline = new OfflineAudioContext(1, length, WHISPER_RATE)
    const node = offline.createBufferSource()
    node.buffer = audio
    node.connect(offline.destination)
    node.start()
    const mono = await offline.startRendering()
    return mono.getChannelData(0)
  } finally {
    void ctx.close()
  }
}

function transcribe(audio: Float32Array, language: string, onProgress: (p: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const w = stt()
    const listen = (
      e: MessageEvent<{ text?: string; progress?: number; error?: string; ready?: boolean }>,
    ) => {
      if (e.data.progress !== undefined) return onProgress(e.data.progress)
      if (e.data.ready) return
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
  /** Microphone loudness 0–1 while listening, so the screen shows that it hears. */
  const [level, setLevel] = useState(0)
  const meter = useRef<{ ctx: AudioContext; frame: number } | null>(null)
  const stopMeter = useCallback(() => {
    if (!meter.current) return
    cancelAnimationFrame(meter.current.frame)
    void meter.current.ctx.close()
    meter.current = null
    setLevel(0)
  }, [])
  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext()
      void ctx.resume()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128))
        setLevel(Math.min(1, peak / 64))
        if (meter.current) meter.current.frame = requestAnimationFrame(tick)
      }
      meter.current = { ctx, frame: requestAnimationFrame(tick) }
    } catch {
      // No meter is fine; recording goes on.
    }
  }, [])
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((t) => t.stop())
      stopMeter()
    },
    [stopMeter],
  )

  const start = useCallback(async () => {
    if (!supported) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream)
      chunks.current = []
      r.ondataavailable = (e) => chunks.current.push(e.data)
      // Small slices, so a short answer is never lost in one unflushed chunk (Safari).
      r.start(250)
      recorder.current = r
      startMeter(stream)
      setState('listening')
    } catch {
      setState('error')
    }
  }, [supported, startMeter])

  const stop = useCallback(async (): Promise<string> => {
    const r = recorder.current
    if (!r) return ''
    recorder.current = null
    const done = new Promise<void>((resolve) => (r.onstop = () => resolve()))
    r.stop()
    await done
    r.stream.getTracks().forEach((t) => t.stop())
    stopMeter()
    setState('transcribing')
    try {
      const samples = await toSamples(new Blob(chunks.current, { type: r.mimeType }))
      const text = await transcribe(samples, whisperLanguage(locale), (p) => {
        setState('loading')
        setProgress(p)
      })
      setProgress(null)
      const clean = cleanTranscript(text)
      setState(clean ? 'idle' : 'empty')
      return clean
    } catch {
      setProgress(null)
      setState('failed')
      return ''
    }
  }, [locale, stopMeter])

  const cancel = useCallback(() => {
    const r = recorder.current
    recorder.current = null
    if (r) {
      r.onstop = null
      r.stop()
      r.stream.getTracks().forEach((t) => t.stop())
    }
    stopMeter()
    setState('idle')
  }, [stopMeter])

  return { state, progress, level, supported, start, stop, cancel }
}

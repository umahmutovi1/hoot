/// <reference lib="webworker" />
import type { KokoroTTS } from 'kokoro-js'

/**
 * Text to speech on the device (Kokoro 82M, English only, q8 ≈ 90 MB the first time, then from
 * the browser cache). Messages: { text } → { audio: Float32Array, rate } | { progress } |
 * { error }.
 */
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const VOICE = 'af_heart'
let tts: Promise<KokoroTTS> | null = null

function load() {
  tts ??= import('kokoro-js').then(({ KokoroTTS }) =>
    KokoroTTS.from_pretrained(MODEL, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status: string; progress?: number }) => {
        if (p.status === 'progress' && p.progress !== undefined)
          self.postMessage({ progress: Math.round(p.progress) })
      },
    }),
  )
  return tts
}

self.onmessage = async (event: MessageEvent<{ text?: string; warm?: boolean }>) => {
  try {
    const model = await load()
    if (event.data.warm || !event.data.text) {
      self.postMessage({ ready: true })
      return
    }
    const audio = await model.generate(event.data.text, { voice: VOICE })
    self.postMessage({ audio: audio.audio, rate: audio.sampling_rate }, [audio.audio.buffer])
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}

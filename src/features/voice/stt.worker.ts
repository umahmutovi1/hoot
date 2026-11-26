/// <reference lib="webworker" />
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

/**
 * Speech to text on the device (Whisper base, multilingual, q8 ≈ 80 MB the first time, then from
 * the browser cache). The audio never leaves the phone. Messages: { audio: Float32Array (16 kHz
 * mono), language } → { text } | { progress } | { error }.
 */
const MODEL = 'onnx-community/whisper-base'
let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null

function load() {
  asr ??= import('@huggingface/transformers').then(
    ({ pipeline }) =>
      // The overloads of `pipeline` are too wide for the checker; the task fixes the type.
      (pipeline as (task: string, model: string, options: object) => Promise<unknown>)(
        'automatic-speech-recognition',
        MODEL,
        {
          dtype: 'q8',
          progress_callback: (p: { status: string; progress?: number }) => {
            if (p.status === 'progress' && p.progress !== undefined)
              self.postMessage({ progress: Math.round(p.progress) })
          },
        },
      ) as Promise<AutomaticSpeechRecognitionPipeline>,
  )
  return asr
}

self.onmessage = async (
  event: MessageEvent<{ audio?: Float32Array; language?: string; warm?: boolean }>,
) => {
  // Only this app's pages may talk to the worker (a dedicated worker reports '' or its origin).
  if (event.origin !== '' && event.origin !== self.location.origin) return
  try {
    const run = await load()
    if (event.data.warm || !event.data.audio) {
      self.postMessage({ ready: true })
      return
    }
    const out = await run(event.data.audio, {
      language: event.data.language,
      task: 'transcribe',
      chunk_length_s: 30,
    })
    const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text
    self.postMessage({ text })
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}

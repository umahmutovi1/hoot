/// <reference lib="webworker" />
import type { OptimizerResult, TrainReview } from '@/lib/srs/optimize'

/**
 * FSRS-6 optimizer in a Web Worker (threadless WASI build: no SharedArrayBuffer, so no
 * COOP/COEP headers; the CSP needs `'wasm-unsafe-eval'`). The binding is imported inside the
 * handler: its loader awaits the wasm at the top level, and a handler set after that would miss
 * the first message.
 */
self.onmessage = async (event: MessageEvent<TrainReview[][]>) => {
  try {
    const b = await import('@open-spaced-repetition/binding-wasm32-wasip1')
    const items = event.data.map(
      (seq) => new b.FSRSBindingItem(seq.map((r) => new b.FSRSBindingReview(r.rating, r.deltaT))),
    )
    const options = { enableShortTerm: false, modelVersion: 'FSRS-6' as const }
    const w = await b.computeParameters(items, options)
    const personal = await b.evaluateWithTimeSeriesSplits(items, options)
    const defaults = new b.FSRSBinding().evaluate(items)
    const result: OptimizerResult = {
      w,
      logLoss: personal.logLoss,
      defaultLogLoss: defaults.logLoss,
    }
    self.postMessage({ result })
  } catch (e) {
    self.postMessage({ error: String(e) })
  }
}

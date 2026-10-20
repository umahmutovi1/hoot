// USD per 1M tokens. Gemini rows are the paid-tier list price: on the free tier nothing is
// billed, but ai_runs still shows what the same calls would cost.
export const PRICES: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  // Up to 100k prompt tokens; prompts here stay far below that.
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
}

/** Cost of one call, rounded to the ai_runs column (6 decimals); null for an unknown model. */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = PRICES[model]
  if (!price) return null
  const cost = (inputTokens * price.input + outputTokens * price.output) / 1_000_000
  return Math.round(cost * 1_000_000) / 1_000_000
}

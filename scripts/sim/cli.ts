import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { simulate, summarize, type BlockExample, type RunMetrics } from './run'
import { DEFAULT_STUDENT } from './student'

/**
 * `npm run sim -- [--seeds 100] [--baseline] [--examples ml/data/sim_blocks.json]`
 * Prints the mean metrics over seeds 1..N. `--baseline` writes them to `scripts/sim/baseline.json`
 * (what later changes are compared against); `--examples` writes every block for `ml/`.
 */
const args = process.argv.slice(2)
const option = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : (args[i + 1] ?? '')
}
const seeds = Number(option('seeds') ?? 100)

const runs: RunMetrics[] = []
const examples: BlockExample[] = []
for (let seed = 1; seed <= seeds; seed++) {
  const result = simulate(seed)
  runs.push(result.metrics)
  examples.push(...result.examples)
}
const summary = summarize(runs)
console.log(JSON.stringify(summary, null, 2))

if (args.includes('--baseline')) {
  const file = new URL('./baseline.json', import.meta.url)
  writeFileSync(file, `${JSON.stringify({ seeds, student: DEFAULT_STUDENT, summary }, null, 2)}\n`)
  console.log(`baseline → ${file.pathname}`)
}
const out = option('examples')
if (out) {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(examples))
  console.log(`${examples.length} blocks → ${out}`)
}

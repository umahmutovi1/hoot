import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { BETTER, TOLERANCE, worse } from './compare'
import {
  simulate,
  summarize,
  type BlockExample,
  type Estimator,
  type RunMetrics,
  type SlotMode,
  type Summary,
} from './run'
import { DEFAULT_STUDENT } from './student'

/**
 * `npm run sim -- [--seeds 100] [--estimator model|old] [--slots model|off] [--baseline]
 * [--examples ml/data/sim_blocks.json] [--check] [--report sim.md]`
 * Prints the mean metrics over seeds 1..N. `--baseline` writes them to `scripts/sim/baseline.json`
 * (what later changes are compared against); `--examples` writes every block for `ml/`;
 * `--check` exits with 1 when a metric got worse than the baseline beyond its tolerance (the gate
 * of `train.yml`); `--report` writes the comparison as Markdown.
 */
const args = process.argv.slice(2)
const option = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : (args[i + 1] ?? '')
}
const seeds = Number(option('seeds') ?? 100)
const estimator = (option('estimator') ?? 'model') as Estimator
const slots = (option('slots') ?? 'model') as SlotMode

const runs: RunMetrics[] = []
const examples: BlockExample[] = []
for (let seed = 1; seed <= seeds; seed++) {
  const result = simulate(seed, DEFAULT_STUDENT, undefined, estimator, slots)
  runs.push(result.metrics)
  examples.push(...result.examples)
}
const summary = summarize(runs)
console.log(JSON.stringify(summary, null, 2))

if (args.includes('--baseline')) {
  const file = new URL('./baseline.json', import.meta.url)
  writeFileSync(
    file,
    `${JSON.stringify({ seeds, estimator, slots, student: DEFAULT_STUDENT, summary }, null, 2)}\n`,
  )
  console.log(`baseline → ${file.pathname}`)
}
const out = option('examples')
if (out) {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(examples))
  console.log(`${examples.length} blocks → ${out}`)
}

const baselineFile = new URL('./baseline.json', import.meta.url)
const saved = JSON.parse(readFileSync(baselineFile, 'utf8')) as { seeds: number; summary: Summary }
const baseline = saved.summary
const bad = worse(summary, baseline)
const report = option('report')
if (report) {
  const rows = (Object.keys(BETTER) as (keyof Summary)[]).map((k) => {
    const change = baseline[k] === 0 ? 0 : (summary[k] - baseline[k]) / Math.abs(baseline[k])
    const limit = BETTER[k] ? `${BETTER[k]}, ${TOLERANCE[k] * 100}%` : '–'
    return `| ${k} | ${baseline[k]} | ${summary[k]} | ${(change * 100).toFixed(1)}% | ${limit} | ${bad.includes(k) ? 'pogoršanje' : 'ok'} |`
  })
  writeFileSync(
    report,
    [
      `## Simulator (${seeds} seedova)`,
      '',
      '| metrika | baseline | sada | promjena | bolje / tolerancija | |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n'),
  )
}
if (args.includes('--check')) {
  if (seeds !== saved.seeds) {
    console.error(`--check needs the baseline's ${saved.seeds} seeds`)
    process.exit(2)
  }
  if (bad.length > 0) {
    console.error(`worse than the baseline: ${bad.join(', ')}`)
    process.exit(1)
  }
  console.log('no metric worse than the baseline')
}

import { readFileSync, writeFileSync } from 'node:fs'
import { sourceRate, type SourceStats } from '@/lib/estimates/model'
import {
  completionProbability,
  fitCompletion,
  subjectEffects,
  type BlockFeatures,
  type CompletionExample,
} from '@/lib/slots/completion'
import type { SlotPart } from '@/lib/schedule/rhythm'

/**
 * `npm run ml:cases`: recomputes the expected numbers of the cases shared with `ml/` (TS = Python)
 * from the current priors, keeping their inputs. Run after a prior changes (`train.yml` does);
 * the Python tests then check `ml/` against the same numbers.
 */

const write = (path: string, data: unknown) =>
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)

const durationPath = 'src/lib/estimates/model.cases.json'
const duration = JSON.parse(readFileSync(durationPath, 'utf8')) as {
  note: string
  cases: { source: SourceStats; others: SourceStats[]; expected: unknown }[]
}
for (const c of duration.cases) {
  const r = sourceRate(c.source, c.others)
  c.expected = { mean: r.mean, p50: r.p50, p80: r.p80, unitP80: r.unitP80 }
}
write(durationPath, duration)

const completionPath = 'src/lib/slots/completion.cases.json'
const completion = JSON.parse(readFileSync(completionPath, 'utf8')) as {
  note: string
  today: string
  queries: (BlockFeatures & { subjectId: string | null })[]
  cases: { examples: CompletionExample[]; preferred: SlotPart[]; expected: unknown }[]
}
for (const c of completion.cases) {
  const post = fitCompletion(c.examples, completion.today, c.preferred)
  c.expected = {
    mean: post.mean,
    subjects: subjectEffects(post).map(({ subjectId, mean, sd }) => ({ subjectId, mean, sd })),
    probabilities: completion.queries.map((q) => completionProbability(post, q, q.subjectId)),
  }
}
write(completionPath, completion)
console.log(`cases → ${durationPath}, ${completionPath}`)

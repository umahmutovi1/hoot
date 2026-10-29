import { seededRandom } from '@/lib/scheduler'

/** Seeded draws for the simulator; one stream per run, so a seed always gives the same run. */
export interface Rng {
  next: () => number
  normal: (mean?: number, sd?: number) => number
  logNormal: (mu: number, sigma: number) => number
  int: (min: number, max: number) => number
  chance: (p: number) => boolean
  pick: <T>(items: readonly T[]) => T
}

export function rng(seed: number): Rng {
  const next = seededRandom(seed)
  let spare: number | null = null
  const normal = (mean = 0, sd = 1) => {
    if (spare !== null) {
      const z = spare
      spare = null
      return mean + sd * z
    }
    // Box–Muller; 1 - u keeps the log away from 0.
    const u = 1 - next()
    const v = next()
    const r = Math.sqrt(-2 * Math.log(u))
    spare = r * Math.sin(2 * Math.PI * v)
    return mean + sd * r * Math.cos(2 * Math.PI * v)
  }
  return {
    next,
    normal,
    logNormal: (mu, sigma) => Math.exp(normal(mu, sigma)),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)]!,
  }
}

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

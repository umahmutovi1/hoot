import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { rhythmSuggestion, sessionRhythm, type RhythmSession } from './rhythm'
import { BUILT_IN_PRESETS, MINUTE, type Segment } from './timer'

const NOW = new Date('2026-11-02T18:00:00Z')
const standard = BUILT_IN_PRESETS[0]!

/** A session `daysAgo` with study stretches and pauses in minutes: [38, 12, 38] = 38 on, 12 off, 38 on. */
function session(
  pattern: number[],
  daysAgo = 1,
  plannedMinutes: number | null = null,
): RhythmSession {
  let t = NOW.getTime() - daysAgo * 86_400_000
  const segments: Segment[] = []
  pattern.forEach((m, i) => {
    if (i % 2 === 0) {
      segments.push({
        id: `s${i}`,
        unitId: null,
        startedAt: new Date(t),
        endedAt: new Date(t + m * MINUTE),
      })
    }
    t += m * MINUTE
  })
  return { segments, endedAt: new Date(t), plannedMinutes }
}

describe('sessionRhythm', () => {
  it('median study before the first pause, median pause, early share', () => {
    const list = Array.from({ length: 8 }, (_, i) => session([38, 12, 38], i + 1, i < 4 ? 100 : 76))
    expect(sessionRhythm(list, NOW)).toEqual({
      sessions: 8,
      firstBreakMin: 38,
      pauseMin: 12,
      // 76 min studied: 4 of 8 planned at 100 ended early.
      earlyShare: 0.5,
    })
  })

  it('needs 8 sessions in the last 6 weeks', () => {
    const old = Array.from({ length: 8 }, () => session([40], 50))
    expect(sessionRhythm(old, NOW)).toBeNull()
    expect(
      sessionRhythm(
        old.slice(0, 7).map(() => session([40])),
        NOW,
      ),
    ).toBeNull()
  })

  it('a session without a pause counts whole; a unit switch is not a pause', () => {
    const list = Array.from({ length: 8 }, () => session([30, 0, 25]))
    expect(sessionRhythm(list, NOW)).toMatchObject({ firstBreakMin: 55, pauseMin: null })
  })
})

describe('rhythmSuggestion', () => {
  const rhythm = (firstBreakMin: number, pauseMin: number | null = 12) => ({
    sessions: 10,
    firstBreakMin,
    pauseMin,
    earlyShare: 0,
  })

  it('“Tvoje sesije traju oko 38 min — prebaci na 40/10?”', () => {
    expect(rhythmSuggestion(rhythm(38, 10), standard)).toEqual({
      workMin: 40,
      breakMin: 10,
      aboutMin: 38,
    })
  })

  it('no card without a clear difference, for flow / free presets, or without data', () => {
    expect(rhythmSuggestion(rhythm(45), standard)).toBeNull()
    expect(rhythmSuggestion(rhythm(Number.NaN), standard)).toBeNull()
    expect(rhythmSuggestion(rhythm(30), BUILT_IN_PRESETS[2]!)).toBeNull()
    expect(rhythmSuggestion(null, standard)).toBeNull()
  })

  it('without pauses the break keeps the preset’s ratio', () => {
    // 50/15 scaled to 30 → 9 → 10
    expect(rhythmSuggestion(rhythm(30, null), standard)).toMatchObject({
      workMin: 30,
      breakMin: 10,
    })
  })

  it('property: a suggestion is a cycle within 20–90 / 5–30, clearly away from the preset', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.option(fc.integer({ min: 1, max: 60 })),
        (w, p) => {
          const s = rhythmSuggestion(rhythm(w, p), standard)
          if (!s) return
          expect(s.workMin % 5).toBe(0)
          expect(s.workMin).toBeGreaterThanOrEqual(20)
          expect(s.workMin).toBeLessThanOrEqual(90)
          expect(s.breakMin).toBeGreaterThanOrEqual(5)
          expect(s.breakMin).toBeLessThanOrEqual(30)
          expect(Math.abs(s.workMin - 50)).toBeGreaterThanOrEqual(10)
        },
      ),
    )
  })
})

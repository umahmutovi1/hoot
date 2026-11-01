import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { energyFactors, HIGH_ENERGY_FACTOR, LOW_ENERGY_FACTOR, type EnergyDay } from '.'

const today = '2026-11-03'
const day = (back: number, p: Partial<EnergyDay> = {}): EnergyDay => ({
  date: addDays(today, -back),
  energy: 'normal',
  studiedMin: 120,
  plannedMin: 150,
  skipped: false,
  ...p,
})
const usual = [1, 2, 3, 4, 5].map((b) => day(b))

describe('energyFactors', () => {
  it('uses the priors without history', () => {
    expect(energyFactors([], today)).toMatchObject({
      low: LOW_ENERGY_FACTOR,
      high: HIGH_ENERGY_FACTOR,
      usualMin: null,
    })
  })

  it('learns that low means nothing at all for this user', () => {
    const lows = [6, 8, 10, 12, 14, 16].map((b) => day(b, { energy: 'low', studiedMin: 0 }))
    const f = energyFactors([...usual, ...lows], today)
    expect(f.lowDays).toBe(6)
    expect(f.low).toBeCloseTo((0 + 3 * 0.6) / 9, 3)
  })

  it('learns a small share and stays in [0, 1]', () => {
    const lows = [6, 8, 10].map((b) => day(b, { energy: 'low', studiedMin: 24 }))
    expect(energyFactors([...usual, ...lows], today).low).toBeCloseTo((3 * 0.2 + 3 * 0.6) / 6, 3)
    const over = [6, 8].map((b) => day(b, { energy: 'low', studiedMin: 400 }))
    expect(energyFactors([...usual, ...over], today).low).toBeLessThanOrEqual(1)
  })

  it('never lets high go over the growth factor or under 1', () => {
    const highs = [6, 8, 10].map((b) => day(b, { energy: 'high', studiedMin: 600 }))
    expect(energyFactors([...usual, ...highs], today).high).toBe(HIGH_ENERGY_FACTOR)
    const flat = [6, 8, 10].map((b) => day(b, { energy: 'high', studiedMin: 60 }))
    expect(energyFactors([...usual, ...flat], today).high).toBeGreaterThanOrEqual(1)
  })

  it('ignores today, skipped days and days outside the window', () => {
    const f = energyFactors(
      [
        ...usual,
        day(0, { energy: 'low', studiedMin: 0 }),
        day(7, { energy: 'low', studiedMin: 0, skipped: true }),
        day(80, { energy: 'low', studiedMin: 0 }),
      ],
      today,
    )
    expect(f.lowDays).toBe(0)
    expect(f.low).toBe(LOW_ENERGY_FACTOR)
  })

  it('needs a few usual days before measuring', () => {
    const f = energyFactors([day(1), day(6, { energy: 'low', studiedMin: 0 })], today)
    expect(f).toMatchObject({ lowDays: 0, low: LOW_ENERGY_FACTOR, usualMin: null })
  })
})

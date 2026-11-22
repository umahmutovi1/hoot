import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import { exam, FROM, state, subject, units } from './fixtures'
import { plan } from './plan'
import { summaryOffer } from './summaryOffer'

const fifth = (_: string, reading: number) => Math.round(reading * 0.2)

function tight(priority: number) {
  const u = units('a', 10, 60)
  const s = state({
    subjects: [subject('a', { priority })],
    units: u,
    goals: [
      exam(
        'ea',
        'a',
        addDays(FROM, 3),
        u.map((x) => x.id),
      ),
    ],
  })
  return { s, u, r: plan(s) }
}

describe('summaryOffer', () => {
  it('offers summaries for unread chapters with text and says whether the work then fits', () => {
    const { s, u, r } = tight(2)
    expect(r.deficits[0]!.minutes).toBeGreaterThan(0)
    const hasText = new Set(u.map((x) => x.id))
    const offer = summaryOffer(s, r, 'ea', hasText, fifth)!
    expect(offer.unitIds).toHaveLength(10)
    expect(offer.readMinutes).toBe(600)
    expect(offer.summaryMinutes).toBe(120)
    expect(offer.deficitAfter).toBe(0)
    expect(offer.deficitBefore).toBe(r.deficits[0]!.minutes)
  })

  it('skips units without text or already read', () => {
    const { s, u } = tight(2)
    const read = { ...s, units: s.units.map((x, i) => (i === 0 ? { ...x, level: 1 } : x)) }
    const offer = summaryOffer(
      read,
      plan(read),
      'ea',
      new Set(u.slice(0, 3).map((x) => x.id)),
      fifth,
    )
    expect(offer?.unitIds).toEqual([u[1]!.id, u[2]!.id])
  })

  it('makes no offer for important subjects, without a deficit or without text', () => {
    const important = tight(3)
    expect(
      summaryOffer(important.s, important.r, 'ea', new Set(important.u.map((x) => x.id)), fifth),
    ).toBeNull()
    const { s, r } = tight(2)
    expect(summaryOffer(s, r, 'ea', new Set(), fifth)).toBeNull()
    const easy = state({
      subjects: [subject('a', { priority: 1 })],
      units: units('a', 2, 30),
      goals: [exam('ea', 'a', addDays(FROM, 20), ['a-u00', 'a-u01'])],
    })
    expect(summaryOffer(easy, plan(easy), 'ea', new Set(['a-u00']), fifth)).toBeNull()
  })
})

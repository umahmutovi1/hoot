import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/day'
import cases from './labels.cases.json'
import { blockLabel, type BlockLabel, type BlockStatus } from './labels'

const TODAY = '2026-10-29'
const block = (status: BlockStatus, onDate = addDays(TODAY, -1), hasSession = false) => ({
  status,
  onDate,
  hasSession,
})

describe('blockLabel', () => {
  it('done only when confirmed: the status or a session on the block', () => {
    expect(blockLabel(block('done'), TODAY)).toBe('done')
    expect(blockLabel(block('missed', undefined, true), TODAY)).toBe('done')
    expect(blockLabel(block('in_progress', TODAY, true), TODAY)).toBe('done')
  })

  it('"Danas ne mogu" is an explicit skip', () => {
    expect(blockLabel(block('skipped', TODAY), TODAY)).toBe('skipped')
  })

  it('a passed block with nothing marked is unconfirmed, also when it was set to missed', () => {
    expect(blockLabel(block('missed'), TODAY)).toBe('unconfirmed')
    expect(blockLabel(block('planned'), TODAY)).toBe('unconfirmed')
  })

  it("today's and later open blocks have no label yet", () => {
    expect(blockLabel(block('planned', TODAY), TODAY)).toBeNull()
    expect(blockLabel(block('planned', addDays(TODAY, 3)), TODAY)).toBeNull()
  })

  it('elapsed time never makes a block done', () => {
    const statuses: BlockStatus[] = ['planned', 'in_progress', 'missed', 'skipped']
    fc.assert(
      fc.property(
        fc.constantFrom(...statuses),
        fc.integer({ min: -400, max: 400 }),
        fc.integer({ min: 0, max: 400 }),
        (status, offset, later) => {
          const onDate = addDays(TODAY, offset)
          const label = blockLabel({ status, onDate, hasSession: false }, addDays(onDate, later))
          expect(label).not.toBe('done')
        },
      ),
    )
  })

  it('the cases shared with ml/ (TS = Python)', () => {
    for (const c of cases.cases)
      expect(
        blockLabel(
          { status: c.status as BlockStatus, onDate: c.onDate, hasSession: c.hasSession },
          cases.today,
        ),
      ).toBe(c.label as BlockLabel | null)
  })
})

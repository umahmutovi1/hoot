import { describe, expect, it } from 'vitest'
import { examsAwaitingResult, resultKey } from './results'

const exam = (id: string, at: string, extra = {}) => ({
  id,
  at,
  result_points: null as number | null,
  result_annulled: false,
  passed: false,
  archived_at: null as string | null,
  ...extra,
})
const day = (iso: string) => iso.slice(0, 10)

describe('examsAwaitingResult', () => {
  it('asks from the day after the exam, newest first', () => {
    const list = [
      exam('a', '2026-11-20T08:00:00Z'),
      exam('b', '2026-11-27T08:00:00Z'),
      exam('today', '2026-11-28T08:00:00Z'),
      exam('future', '2026-12-17T08:00:00Z'),
    ]
    expect(examsAwaitingResult(list, '2026-11-28', day).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('skips exams with a result, waived, passed, archived or too old', () => {
    const list = [
      exam('points', '2026-11-27T08:00:00Z', { result_points: 12 }),
      exam('waived', '2026-11-27T08:00:00Z', { result_annulled: true }),
      exam('passed', '2026-11-27T08:00:00Z', { passed: true }),
      exam('archived', '2026-11-27T08:00:00Z', { archived_at: '2026-11-27T10:00:00Z' }),
      exam('old', '2026-10-01T08:00:00Z'),
    ]
    expect(examsAwaitingResult(list, '2026-11-28', day)).toEqual([])
  })

  it('stays quiet while snoozed', () => {
    const list = [exam('b', '2026-11-27T08:00:00Z')]
    const snoozed = { [resultKey('b')]: '2026-11-30' }
    expect(examsAwaitingResult(list, '2026-11-28', day, snoozed)).toEqual([])
    expect(examsAwaitingResult(list, '2026-12-01', day, snoozed).map((e) => e.id)).toEqual(['b'])
  })
})

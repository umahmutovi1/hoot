import { describe, expect, it } from 'vitest'
import { activeDecision, type Feedback } from './feedback'

const row = (status: Feedback['status'], created: string): Feedback => ({
  id: created + status,
  user_id: 'u',
  insight_id: 'first_break',
  candidate_id: null,
  status,
  payload: {},
  created_at: `${created}T10:00:00Z`,
  updated_at: `${created}T10:00:00Z`,
})

describe('activeDecision', () => {
  it('holds an accepted or declined suggestion for 14 days only', () => {
    const rows = [row('accepted', '2026-11-01')]
    expect(activeDecision(rows, 'first_break', '2026-11-10')?.status).toBe('accepted')
    expect(activeDecision(rows, 'first_break', '2026-11-20')).toBeUndefined()
  })

  it('hides "not useful" for good', () => {
    const rows = [row('not_useful', '2026-01-01')]
    expect(activeDecision(rows, 'first_break', '2026-11-20')?.status).toBe('not_useful')
  })

  it('knows nothing about other keys', () => {
    expect(
      activeDecision([row('accepted', '2026-11-01')], 'avoidance:x', '2026-11-02'),
    ).toBeUndefined()
  })
})

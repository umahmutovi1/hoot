import { describe, expect, it } from 'vitest'
import { activeDecisions, acceptedThisWeek } from './feedbackInputs'
import type { Feedback } from './feedback'
const row = (patch: Partial<Feedback> = {}): Feedback => ({
  id: 'a',
  user_id: 'u',
  insight_id: 'recall_share',
  candidate_id: null,
  status: 'accepted',
  payload: { week: '2026-11-02', action: { kind: 'questions_next', blocks: 2 } },
  created_at: '2026-11-01T18:00:00Z',
  updated_at: '2026-11-01T18:00:00Z',
  ...patch,
})
describe('Sprint 17 feedback inputs', () => {
  it('later rejection and not-useful decisions switch off an accepted input', () => {
    const a = row(),
      b = row({ id: 'b', status: 'rejected', created_at: '2026-11-02T09:00:00Z' })
    expect(activeDecisions([a, b])).toEqual([])
    expect(activeDecisions([a, { ...b, status: 'not_useful' }])).toEqual([])
  })
  it('counts accepted actions once per stable key, excluding AI summaries and check-in saves', () => {
    expect(
      acceptedThisWeek(
        [
          row(),
          row({ id: 'b' }),
          row({
            id: 'c',
            insight_id: 'strategist:2026-11-02',
            payload: { kind: 'strategist', week: '2026-11-02' },
          }),
        ],
        '2026-11-02',
      ),
    ).toBe(1)
    expect(acceptedThisWeek([row()], '2026-11-09')).toBe(0)
  })
})

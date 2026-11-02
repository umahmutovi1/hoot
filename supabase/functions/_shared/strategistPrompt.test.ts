import { describe, expect, it } from 'vitest'
import {
  strategistOutputSchema,
  strategistRequestSchema,
  type StrategistRequest,
} from './schemas.ts'
import { strategistRequest } from './strategistPrompt.ts'
const request: StrategistRequest = {
  locale: 'bs',
  week: '2026-11-02',
  rho: 0.8,
  subjects: [],
  topics: [],
  goals: [],
  candidates: [
    {
      id: 'priority:s:4',
      kind: 'set_priority',
      label: 'Priority 4',
      deficit_before: 60,
      deficit_after: 30,
      week_minutes: [],
    },
  ],
}
describe('Sprint 17 strategist boundary', () => {
  it('rejects invented IDs, repeated selections and more than three choices', () => {
    const schema = strategistOutputSchema(['a', 'b', 'c', 'd'])
    const output = (ids: string[]) => ({
      summary: 's',
      risks: [],
      actions: ids.map((candidate_id) => ({ candidate_id, reason: 'r' })),
    })
    expect(schema.safeParse(output(['invented'])).success).toBe(false)
    expect(schema.safeParse(output(['a', 'a'])).success).toBe(false)
    expect(schema.safeParse(output(['a', 'b', 'c', 'd'])).success).toBe(false)
    expect(schema.safeParse(output(['c', 'a'])).success).toBe(true)
  })
  it('rejects private reflections and focus reasons, including nested additions', () => {
    expect(
      strategistRequestSchema.safeParse({ ...request, reflections: ['private'] }).success,
    ).toBe(false)
    expect(
      strategistRequestSchema.safeParse({
        ...request,
        candidates: [{ ...request.candidates[0], focus_reasons: ['phone'] }],
      }).success,
    ).toBe(false)
    expect(strategistRequestSchema.safeParse(request).success).toBe(true)
    const req = strategistRequest(request)
    expect(req.task).toBe('strategist')
    expect(req.text).toBe(JSON.stringify(request))
    expect(
      req.schema.safeParse({
        summary: 's',
        risks: [],
        actions: [{ candidate_id: 'priority:s:4', reason: 'r' }],
      }).success,
    ).toBe(true)
  })
})

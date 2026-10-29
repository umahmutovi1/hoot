import { describe, expect, it } from 'vitest'
import { classifiedKinds, classifyRequest } from './classifyPrompt.ts'
import type { ClassifyEventsRequest } from './schemas.ts'

const req: ClassifyEventsRequest = {
  locale: 'bs',
  subjects: ['Matematika 1'],
  events: [
    {
      id: '7d1c6a52-1f7e-4c43-9d8e-2a0b1c3d4e5f',
      title: 'Trening',
      minutes: 90,
      weekday: 1,
      start_min: 1080,
      weekly: true,
    },
    {
      id: '0b3e2f1a-9c8d-4e7f-8a6b-5c4d3e2f1a0b',
      title: 'Mat 1 A2',
      minutes: 90,
      weekday: 2,
      start_min: 540,
      weekly: true,
    },
  ],
}

describe('classifyRequest', () => {
  it('numbers the events with weekday, time, length and weekly, without ids', () => {
    const r = classifyRequest(req)
    expect(r.task).toBe('classify_events')
    expect(r.text).toContain('1: Trening · Tue 18:00 · 90 min · weekly')
    expect(r.text).toContain('2: Mat 1 A2 · Wed 09:00 · 90 min · weekly')
    expect(r.text).not.toContain(req.events[0]!.id)
  })
})

describe('classifiedKinds', () => {
  it('maps numbers back to ids and drops numbers that were not asked', () => {
    const kinds = classifiedKinds(
      {
        events: [
          { event: 1, kind: 'busy' },
          { event: 2, kind: 'lecture' },
          { event: 9, kind: 'exam' },
        ],
      },
      req,
    )
    expect([...kinds.entries()]).toEqual([
      [req.events[0]!.id, 'busy'],
      [req.events[1]!.id, 'lecture'],
    ])
  })
})

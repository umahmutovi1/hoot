import { describe, expect, it } from 'vitest'
import {
  coveredLeaves,
  isBehind,
  latestLog,
  paceActions,
  sourcePace,
  subjectBehind,
  type PaceLog,
  type PaceUnit,
} from '.'

// 4 (4.1, 4.2) · 5 (5.1, 5.2, 5.3) · 6 — 30 min per leaf
const outline: [string, string | null, number][] = [
  ['4', null, 0],
  ['4.1', '4', 1],
  ['4.2', '4', 1],
  ['5', null, 0],
  ['5.1', '5', 0],
  ['5.2', '5', 0],
  ['5.3', '5', 0],
  ['6', null, 0],
]
const units: PaceUnit[] = outline.map(([id, parentId, level], position) => ({
  id,
  parentId,
  position,
  level,
  minutes: 30,
  amount: 10,
}))

let n = 0
const log = (upTo: string | null, onDate: string, cancelled = false): PaceLog => ({
  id: `l${++n}`,
  onDate,
  createdAt: `2026-10-01T10:00:0${n % 10}Z`,
  sourceId: 'src',
  upToUnitId: upTo,
  cancelled,
})

describe('coveredLeaves', () => {
  it('covers everything up to the unit', () => {
    expect(coveredLeaves(units, '5.2').map((u) => u.id)).toEqual(['4.1', '4.2', '5.1', '5.2'])
  })

  it('a parent covers its sub-units', () => {
    expect(coveredLeaves(units, '5').map((u) => u.id)).toEqual(['4.1', '4.2', '5.1', '5.2', '5.3'])
  })
})

describe('latestLog', () => {
  it('takes the latest day, ignoring cancelled classes', () => {
    const a = log('4.2', '2026-10-05')
    const b = log('5.2', '2026-10-12')
    const c = log(null, '2026-10-19', true)
    expect(latestLog([b, c, a])?.id).toBe(b.id)
  })
})

describe('sourcePace', () => {
  it('is null without logs', () => {
    expect(sourcePace(units, [])).toBeNull()
  })

  it('says where the lecture and the user are and how far behind', () => {
    const pace = sourcePace(units, [log('4.2', '2026-10-05'), log('5.2', '2026-10-12')])!
    expect(pace.lectureAt.id).toBe('5')
    expect(pace.lectureIndex).toBe(2)
    expect(pace.youAt?.id).toBe('4')
    expect(pace.youIndex).toBe(1)
    expect(pace.topCount).toBe(3)
    expect(pace.behindMinutes).toBe(60) // 5.1 and 5.2
    expect(pace.behindAmount).toBe(20)
    expect(pace.behindLectures).toBe(1) // the first lecture is done
  })

  it('counts each lecture that left untouched material', () => {
    const fresh = units.map((u) => ({ ...u, level: 0 }))
    const pace = sourcePace(fresh, [
      log('4.1', '2026-10-01'),
      log('4.2', '2026-10-08'),
      log('5.1', '2026-10-15'),
    ])!
    expect(pace.behindLectures).toBe(3)
    expect(pace.youAt).toBeNull()
    expect(isBehind(subjectBehind([pace]))).toBe(true)
  })

  it('a log that goes back does not count again', () => {
    const fresh = units.map((u) => ({ ...u, level: 0 }))
    const pace = sourcePace(fresh, [log('5.1', '2026-10-01'), log('4.2', '2026-10-08')])!
    expect(pace.behindLectures).toBe(1)
    expect(pace.lectureAt.id).toBe('4')
  })

  it('ignores logs pointing at units that are no longer active', () => {
    expect(sourcePace(units, [log('archived', '2026-10-01')])).toBeNull()
  })
})

describe('paceActions', () => {
  it('suggests nothing below the threshold', () => {
    expect(
      paceActions({ behindLectures: 2, behindMinutes: 240 }, { priority: 3, studyMode: 'regular' }),
    ).toEqual([])
  })

  it('orders actions for a regular subject', () => {
    expect(
      paceActions({ behindLectures: 3, behindMinutes: 60 }, { priority: 3, studyMode: 'regular' }),
    ).toEqual(['raise_priority', 'take_time_from', 'add_minutes'])
  })

  it('offers switching back to regular for a campaign at priority 5', () => {
    expect(
      paceActions(
        { behindLectures: 0, behindMinutes: 300 },
        { priority: 5, studyMode: 'campaign' },
      ),
    ).toEqual(['switch_to_regular', 'start_earlier', 'take_time_from'])
  })
})
